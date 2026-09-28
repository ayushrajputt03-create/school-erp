// Run after applying the receptionist migration. Uses one transaction and always rolls back.
import assert from 'node:assert/strict'
import { connect } from './db.mjs'

const { client } = await connect()
try {
  await client.query('begin')
  const { rows: ids } = await client.query(`select gen_random_uuid() school, gen_random_uuid() receptionist, gen_random_uuid() student, gen_random_uuid() parent`)
  const { school, receptionist, student, parent } = ids[0]
  await client.query(`insert into schools (id, legacy_id, name, code) values ($1,$2,'RBAC Test School','RBAC' || floor(random()*100000)::text)`, [school, `rbac_${Date.now()}`])
  await client.query(`insert into app_users (id, legacy_uid, school_id, role) values ($1,'rbac_receptionist',$2,'receptionist')`, [receptionist, school])
  await client.query(`insert into students (id, school_id, legacy_id, full_name, father_name, father_phone) values ($1,$2,'student_rbac','Reception Test','Parent Test','9999999999')`, [student, school])
  await client.query(`insert into parents (id, school_id, legacy_id, phone) values ($1,$2,'parent_rbac','9999999999')`, [parent, school])
  await client.query(`insert into parent_students (parent_id, student_id, school_id) values ($1,$2,$3)`, [parent, student, school])
  await client.query(`insert into fee_receipts (school_id, legacy_id, student_id, amount, paid_amount, total_due) values ($1,'fee_rbac',$2,100,100,100)`, [school, student])
  await client.query(`insert into notification_templates (school_id, code, title, body) values ($1,'FEE_VISIT','Fee desk visit','Please visit the fee desk.')`, [school])
  await client.query('set local role authenticated')
  await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [receptionist])
  assert.equal((await client.query('select count(*)::int n from students')).rows[0].n, 1, 'receptionist can read students')
  assert.equal((await client.query('select count(*)::int n from fee_receipts')).rows[0].n, 1, 'receptionist can read fees')
  assert.equal((await client.query('select count(*)::int n from staff')).rows[0].n, 0, 'receptionist cannot read staff')
  assert.equal((await client.query('select count(*)::int n from report_marks')).rows[0].n, 0, 'receptionist cannot read marks')
  // INSERT must fail. UPDATE/DELETE can legitimately return zero rows under RLS
  // instead of throwing, so assert the stronger invariant: no row can be changed.
  await client.query('savepoint denied_fee_insert')
  await assert.rejects(
    () => client.query(`insert into fee_receipts (school_id, legacy_id, student_id, amount, paid_amount, total_due) values ('${school}','blocked_insert','${student}',1,1,1)`),
    /row-level security|permission denied/i,
  )
  await client.query('rollback to savepoint denied_fee_insert')
  const update = await client.query(`update fee_receipts set amount = 1 where student_id = '${student}' returning id`)
  const deleted = await client.query(`delete from fee_receipts where student_id = '${student}' returning id`)
  assert.equal(update.rowCount, 0, 'receptionist cannot update fees')
  assert.equal(deleted.rowCount, 0, 'receptionist cannot delete fees')
  assert.equal((await client.query('select count(*)::int n from kv')).rows[0].n, 0, 'receptionist cannot read settings/kv')
  await client.query(`select public.log_receptionist_fee_view($1)`, [student])
  await client.query(`select public.send_receptionist_notification($1, 'FEE_VISIT')`, [student])
  await client.query('reset role')
  assert.equal((await client.query(`select count(*)::int n from audit_logs where school_id = $1 and action in ('receptionist_fee_viewed','receptionist_notification_sent')`, [school])).rows[0].n, 2, 'audits are recorded')
  console.log('ALL PASS — receptionist can only read students/fees and use approved notifications')
} finally {
  await client.query('rollback').catch(() => {})
  await client.end()
}
