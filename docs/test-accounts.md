# Tribo — test accounts

Seed test accounts on dummy Gmail addresses. **Bootstrapped** via the
`BOOTSTRAP_VERIFIED_EMAILS` env var (`appengine-web.xml`): created already
**email-verified** and **backoffice-verified**, so they can log in immediately
(no email link needed) and managers/partners can host activities right away.

All passwords meet the policy (min 8 chars, a lowercase letter, a digit).

## Normal users (END_USER)

| Email | Password |
|-------|----------|
| normaluser1@gmail.com | userpass1 |
| normaluser2@gmail.com | userpass2 |
| normaluser3@gmail.com | userpass3 |

## Activity managers (ACTIVITY_MANAGER)

| Email | Password |
|-------|----------|
| activitymanager1@gmail.com | managerpass1 |
| activitymanager2@gmail.com | managerpass2 |

## Partners (PARTNER)

| Email | Password |
|-------|----------|
| partner1@gmail.com | partnerpass1 |
| partner2@gmail.com | partnerpass2 |

## Backoffice (BACKOFFICE)

Seeded via `BOOTSTRAP_BACKOFFICE_EMAILS`. Used for moderation (approve/verify
users, suspend, etc.) instead of the sysadmin account.

| Email | Password |
|-------|----------|
| boffice1@innertribe.com | bopassword1 |
| boffice2@innertribe.com | bopassword2 |
| boffice3@innertribe.com | bopassword3 |

## Notes
- These are **test** accounts — the addresses don't need to receive mail
  (bootstrapped accounts skip the email-confirmation gate).
- To add/remove seeded accounts, edit `BOOTSTRAP_VERIFIED_EMAILS` (users) or
  `BOOTSTRAP_BACKOFFICE_EMAILS` (backoffice) in
  `api/src/main/webapp/WEB-INF/appengine-web.xml` and redeploy the API.
