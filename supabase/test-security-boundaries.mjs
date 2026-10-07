import assert from 'node:assert/strict'
import { connect } from './db.mjs'

const { client } = await connect()
try {
  await client.query('begin')
  const { rows: [ids] } = await client.query('select gen_random_uuid() school, gen_random_uuid() teacher, gen_random_uuid() colleague')
  const { school, teacher, colleague } = ids
  await client.query("insert into schools(id,legacy_id,name,code) values($1,$2,'Security Test',$3)", [school, `sec_${school}`, `SEC${school.slice(0,8)}`])
  await client.query("insert into app_users(id,legacy_uid,school_id,role) values($1,$2,$3,'teacher')", [teacher, `sec_${teacher}`, school])
  await client.query("insert into app_users(id,legacy_uid,school_id,role) values($1,$2,$3,'teacher')", [colleague, `sec_${colleague}`, school])
  await client.query("insert into staff(school_id,legacy_id,auth_user_id,first_name,source) values($1,'self',$2,'Self','{}'),($1,'colleague',$3,'Other','{}')", [school, teacher, colleague])
  await client.query("insert into kv(school_id,path,value) values($1,'parentSessions','{}'),($1,'staffCredentials','{}'),($1,'employeeManager','{}')", [school])
  await client.query('set local role authenticated')
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [teacher])
  assert.equal((await client.query('select count(*)::int n from staff')).rows[0].n, 1, 'teacher can read only own staff record')
  assert.equal((await client.query('select count(*)::int n from kv')).rows[0].n, 0, 'teacher cannot read credentials or HR settings')
  await client.query('savepoint rate_limit_access')
  await assert.rejects(client.query("select consume_security_rate_limit('test',1,60)"), /permission denied/)
  await client.query('rollback to savepoint rate_limit_access')
  await client.query('reset role')
  assert.equal((await client.query("select consume_security_rate_limit($1,1,60) b", [school])).rows[0].b, true)
  assert.equal((await client.query("select consume_security_rate_limit($1,1,60) b", [school])).rows[0].b, false)
  console.log('PASS: staff privacy, credential isolation, RPC permissions and atomic throttling')
} finally {
  await client.query('rollback').catch(() => {})
  await client.end()
}
