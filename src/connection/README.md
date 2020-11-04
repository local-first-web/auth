### Initial handshake

#### Both are existing members in good standing

| Alice     | Bob       |
| --------- | --------- |
| CLAIM     | CLAIM     |
| CHALLENGE | CHALLENGE |
| PROVE     | PROVE     |
| VERIFY    | VERIFY    |

#### Bob has been invited

| Alice           | Bob         |
| --------------- | ----------- |
| CLAIM           | SHOW_INVITE |
| VALIDATE_INVITE |             |
|                 | CLAIM       |
| CHALLENGE       | CHALLENGE   |
| PROVE           | PROVE       |
| VERIFY          | VERIFY      |

Q: How does Bob know he's talking to a team member?  
A: He validates his own invitation after getting in

start -> RECEIVE_CLAIM -> CHALLENGE -> awaitingProof -> RECEIVE_PROOF -> VERIFY_PROOF ->
