const hre = require("hardhat");

async function main() {
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();
  await voting.waitForDeployment();
  const address = await voting.getAddress();
  console.log("Voting contract deployed to:", address);
  const fs = require("fs");
  fs.writeFileSync("contract_address.txt", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
