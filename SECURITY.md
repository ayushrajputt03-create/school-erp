# Security Policy

## Sensitive data

Do not commit `.env`, `.env.local`, database passwords, access tokens, service
role keys, student exports, or production logs.

The browser application may only use the Firebase Web App configuration.
Authorization is enforced by Realtime Database Security Rules, not by hidden UI.

## Production checklist

1. Enable email confirmation and MFA for administrators.
2. Restrict Firebase Authentication authorized domains.
3. Test Realtime Database rules with the emulator before major policy changes.
4. Verify that users from one school cannot read another school's records.
5. Configure backups and point-in-time recovery appropriate to the plan.
6. Establish retention and deletion procedures for student data.
7. Review applicable school privacy requirements before importing real data.

## Reporting

Report suspected vulnerabilities privately to the system owner. Do not include
student records or credentials in issue trackers.
