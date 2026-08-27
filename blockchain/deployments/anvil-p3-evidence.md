# P3 Anvil integration evidence

Date: 2026-08-25  
Chain ID: `31337`  
Deployment record: `deployments/anvil-31337.json`

This checkpoint used unlocked Anvil accounts through `eth_sendTransaction`.
No private key or project `.env` was read.

## Actors and fixture

| Actor | Address |
| --- | --- |
| Platform/admin/operator/arbitrator | `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266` |
| Student | `0x70997970c51812dc3a010c7d01b50e0d17dc79c8` |
| Tutor | `0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc` |

- Agreement ID: `0x6cbfd4a5d39830ff6d27010ae32016f84962f0c24780e951f304c7c5a6d9d32f`
- Total: `40,000,000` token units (`40 eUSDC`)
- Per session: `4,000,000` token units (`4 eUSDC`)
- Initial balance after mint and before funding: Student `100,000,000`, Tutor
  `0`, Platform `0`, Escrow `0`.

## Transaction evidence

| Action | Transaction hash |
| --- | --- |
| Register agreement | `0x4109a591dc7152f60dacaa268d0822970505609baf21a769d2ad3b0f58ff72d2` |
| Student approve | `0xd842dea56976c4bd05187c6cae1b0370e36b2e9588381549dc43017245ab3880` |
| Student fund | `0x85b6f34fa089f688ee76d92f133686a5ed9aa61389f7a04e8be04a392382a6c8` |
| Session 1 BOTH_PRESENT proposal | `0xbaa25cc427b3bb0aa5b802dc7ff145f7ca727745fa48a2ff64ef6dc8d60555cd` |
| Session 1 finalize 85/15 | `0xf0c25fb38f63b29fc63c05fa313d089e4a6485aa62689bf4df02f87d9cd3f651` |
| Session 2 STUDENT_ABSENT proposal | `0x996b4c9e502a2fb251bffed77bccba72b1b423d3aca3a49733026d795b93a435` |
| Session 2 finalize 45/10/45 | `0x469f81066af863f42d61d3efef075793f052fcf6ce9f60e2eda7643964bed2d9` |
| Session 3 TUTOR_ABSENT proposal | `0xf9fe03df57a9e487c4f31979f6fcade02fdad87b8d5335f985dc36d5f96c58d0` |
| Session 3 refund 100% | `0xcfc1072715e0eca8e633d91237386cd449ad4ee0ee6033736abc5e0206c4ab52` |
| Session 4 BOTH_PRESENT proposal | `0xa7a5c839d9cd62de8e53e6a90ff9cf1edf80aa4ba65932a443589b01e599ebf8` |
| Session 4 open dispute | `0xd4ea172a41d9d3bfb4c87f7c0ae476815e50b06f753528d50bfa8615ebbee9bf` |
| Session 4 resolve APPROVED/refund | `0xe557312a7325279e2416a23dae7a8032450e1c46b65ff63964adb6433804f59e` |
| Session 5 BOTH_PRESENT proposal | `0xfcc800c93f0e63497e9d3eef2b3c3b6327d6070ce3f59b3eefdf30397ef7122a` |
| Session 5 open dispute | `0xa39bf8cc745a395f8deb51c4401a92f420bd16774b42e06822cb80f427b96306` |
| Session 5 resolve REJECTED/85-15 | `0x51adef123c3eb650e0ee6301f0e1b4198d00f1b36b8e6629391bf4a0b41d0666` |
| Cancel and refund unused amount | `0x6bb3400cf901b7bc22024b77b05c5c18c8b9ec913bd75d24c477da92f424e0aa` |

After opening the Session 4 dispute, Anvil time was advanced by `86,401`
seconds. A normal finalize still reverted with
`InvalidSessionStatus(PROPOSED, DISPUTED)`, proving an open complaint remains
locked after the submission deadline.

## Final state and conservation

| Holder/state | Token units | eUSDC |
| --- | ---: | ---: |
| Student balance | 89,800,000 | 89.8 |
| Tutor balance | 8,600,000 | 8.6 |
| Platform balance | 1,600,000 | 1.6 |
| Escrow token balance | 0 | 0 |
| Agreement remainingAmount | 0 | 0 |
| Agreement releasedAmount | 10,200,000 | 10.2 |
| Agreement refundedAmount | 29,800,000 | 29.8 |

Checks:

- `89.8 + 8.6 + 1.6 = 100 eUSDC`.
- `releasedAmount + refundedAmount = 40 eUSDC` funded.
- Agreement status is `CANCELLED`, five sessions are final, and
  `openSessions = 0`.
- Session 1/2/5 are `SETTLED`; Session 3/4 are `REFUNDED`.
- Tutor only received payout; it never funded or held the escrow balance.

The ADMIN/STAFF classroom-reviewer restriction is an application authorization
rule for P4 Contract Service. P3 confirms only the shared on-chain
`ARBITRATOR_ROLE` execution path.
