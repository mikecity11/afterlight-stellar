# Validation — 4 October 2026

Eight offline tests pass. Real Stellar testnet verification completed for all six scenario/recovery combinations:

| Scenario | Recovery | Received | App status | Verdict |
| --- | --- | --- | --- | --- |
| Lost response | Broken | 2 XLM | paid | FAIL |
| Lost response | Correct | 1 XLM | paid | PASS |
| Outage | Broken | 0 XLM | failed | FAIL |
| Outage | Correct | 1 XLM | paid | PASS |
| Missing trustline | Broken | 0 LAB | failed | FAIL |
| Missing trustline | Correct | 0 LAB | rejected | PASS |

The deliberate broken implementations failed the assertions as expected; correct implementations passed.

## Example transaction evidence

Broken lost-response experiment produced two successful transactions:

- https://stellar.expert/explorer/testnet/tx/2d757b3afc1be619c57ddee0989c30f89cdb3280b4bdcff1c7975032674d0415
- https://stellar.expert/explorer/testnet/tx/c9d2983e59b747a9efb07358ecc1dafb807bcfaa04c60b49584538b75affc9b1

Correct lost-response experiment produced one successful transaction:

- https://stellar.expert/explorer/testnet/tx/e9846996a336516dc9196a93133e3213bb70a21b8aa1ea4844826da8e6c7873d

Correct outage recovery:

- https://stellar.expert/explorer/testnet/tx/039b53b7f08a23112848607d525b7427ed7143e233d61242d5f3ffd45cd17c42

Confirmed failed missing-trustline transaction:

- https://stellar.expert/explorer/testnet/tx/be21fed05ca98c73f5d65f08678ef60970490e394643694a2d4194ff9ecf45cc

Testnet history may be cleared during network resets.

## HTTP checks

Home, lab, docs, about, app JavaScript, and stylesheet returned HTTP 200 from the local server. Invalid proxy XDR returned HTTP 400.

## Verification still needed

Browser visual verification could not complete because the browser daemon failed to start in this environment. GitHub publication and Vercel deployment are pending repository creation and available Vercel account/team access. API duration and static/API routing must be checked on Vercel after deployment.
