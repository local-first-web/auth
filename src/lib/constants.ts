export enum HashPurpose {
  Signature = 'SIGNATURE',
  EncryptionAsymmetric = 'ENCRYPTION_ASYMMETRIC',
  EncryptionSymmetric = 'ENCRYPTION_SYMMETRIC',
  LinkToPrevious = 'LINK_TO_PREVIOUS',
  InvitationIdFromInvitationKey = 'INVITATION_ID_FROM_INVITATION_KEY',
  SigningPairFromFromInvitationKey = 'SIGNING_PAIR_FROM_FROM_INVITATION_KEY',
  Invitation = 'INVITATION',
}
