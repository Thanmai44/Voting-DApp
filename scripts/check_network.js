const hre = require("hardhat");

async function main() {
    const provider = hre.ethers.provider;
    const network = await provider.getNetwork();
    console.log("Connected to network name:", network.name);
    console.log("Connected to chain ID:", network.chainId.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
