const hre = require("hardhat");

async function main() {
    const address = "0x71909Ec39C7CE019d78bAe59Ec707C9b8A24A9A7"; // Sepolia Address
    const Voting = await hre.ethers.getContractFactory("Voting");
    const contract = Voting.attach(address);

    console.log("Checking Election Status...");
    try {
        const active = await contract.electionActive();
        console.log("Election Active:", active);
    } catch (e) {
        console.error("Error:", e.reason || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
