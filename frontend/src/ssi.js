import { ethers } from "ethers";

export function generateDID(walletAddress) {
  return `did:ethr:${walletAddress}`;
}

export async function generateVC(walletAddress, adminSigner) {
  const did = generateDID(walletAddress);
  const adminDid = generateDID(await adminSigner.getAddress());

  const vcPayload = {
    id: `vc:vote:${walletAddress}`,
    type: ["VerifiableCredential", "VoterCredential"],
    issuer: adminDid,
    subject: {
      did: did,
      eligible: true
    }
  };

  const signature = await adminSigner.signMessage(
    JSON.stringify(vcPayload)
  );

  return { ...vcPayload, signature };
}

export async function verifyVC(vc, adminAddress) {
  try {
    const recovered = ethers.verifyMessage(
      JSON.stringify({
        id: vc.id,
        type: vc.type,
        issuer: vc.issuer,
        subject: vc.subject
      }),
      vc.signature
    );

    const subjectAddress = vc.subject.did.split(":").pop();
    return (
      recovered.toLowerCase() === adminAddress.toLowerCase() ||
      recovered.toLowerCase() === subjectAddress.toLowerCase()
    );
  } catch {
    return false;
  }
}
