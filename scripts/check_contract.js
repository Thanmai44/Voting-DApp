const hre = require("hardhat");

async function main() {
    // This address was from our previous deployment log
    const address = "0x71909Ec39C7CE019d78bAe59Ec707C9b8A24A9A7";
    const Voting = await hre.ethers.getContractFactory("Voting");
    const contract = Voting.attach(address);

    console.log("Checking contract at:", address);
    try {
        const count = await contract.candidatesCount();
        console.log("Candidates Count:", count.toString());
        const admin = await contract.admin();
        console.log("Admin Address:", admin);
    } catch (e) {
        console.error("Error reading contract:", e.reason || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
