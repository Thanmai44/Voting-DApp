const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    // 1. Setup Provider (Sepolia via Alchemy/Infura or simple RPC)
    // Using a public RPC for Sepolia for now, or the user's hardhat config network if possible.
    // Let's try a public one first.
    const provider = new ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/wbz73dvMj0Zn0Pv6cd-1M");
    // Alternate: https://ethereum-sepolia-rpc.publicnode.com

    // 2. Contract Details
    const contractAddress = "0xe75BCF0728F5AF94D677fBB9F8a1072c6FDD49D1";

    // Load ABI
    const abiPath = path.join(__dirname, "frontend/src/Voting.json");
    if (!fs.existsSync(abiPath)) {
        console.error("ABI file not found at:", abiPath);
        return;
    }
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;

    // Check wallet from private key
    require("dotenv").config();
    if (process.env.PRIVATE_KEY) {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        console.log("Wallet Address (from .env):", wallet.address);
    }

    const contract = new ethers.Contract(contractAddress, abi, provider);

    console.log(`Connecting to contract at ${contractAddress}...`);

    try {
        // 3. call candidatesCount
        console.log("Calling candidatesCount()...");
        const count = await contract.candidatesCount();
        console.log(`Candidates Count: ${count}`);

        // 4. Loop and fetch
        for (let i = 1; i <= count; i++) {
            console.log(`Fetching candidate ${i}...`);
            const candidate = await contract.getCandidate(i);
            console.log(`Candidate ${i}:`, candidate);
        }
        console.log("Done fetching.");

        // 5. Check if election started
        const started = await contract.electionStarted();
        console.log("Election Started:", started);

        const admin = await contract.admin();
        console.log("Admin Address:", admin);

        // 6. Try adding a candidate (if wallet matches)
        if (process.env.PRIVATE_KEY) {
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            if (wallet.address.toLowerCase() === admin.toLowerCase()) {
                const contractWithSigner = contract.connect(wallet);
                
                if (!started) {
                    console.log("Starting election...");
                    const startTx = await contractWithSigner.startElection();
                    await startTx.wait();
                    console.log("Election started!");
                }

                console.log("Attempting to add candidate 'DebugCandidate' after election starts...");
                try {
                    const tx = await contractWithSigner.addCandidate("DebugCandidate", { gasLimit: 500000 });
                    console.log("Transaction sent:", tx.hash);
                    await tx.wait();
                    console.log("Candidate added successfully!");
                } catch (addError) {
                    console.error("Failed to add candidate!");
                    console.error(addError);
                }
            }
        }

    } catch (error) {
        console.error("Error interacting with contract:", error);
    }
}

main();
