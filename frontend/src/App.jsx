import { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import abiFile from "./Voting.json";
import "./App.css";

import { generateVC, verifyVC } from "./ssi";

const contractAddress = "0xcf9B301500aff227096E2FF6F52661A46250d64a";
const contractABI = abiFile.abi;

function App() {
  const [wallet, setWallet] = useState("");
  const [admin, setAdmin] = useState("");
  const [contract, setContract] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [winner, setWinner] = useState("");

  const [newVoter, setNewVoter] = useState("");
  const [batchVoters, setBatchVoters] = useState("");
  const [newCandidate, setNewCandidate] = useState("");
  const [status, setStatus] = useState("");

  const [vc, setVC] = useState(null);

  async function checkNetwork() {
    if (!window.ethereum) return;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0xaa36a7") { // Sepolia Chain ID
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      } catch (error) {
        toast.error("Please switch MetaMask to Sepolia!");
      }
    }
  }

  async function debugConnection() {
    if (!contract) return toast.error("Connect Wallet First");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const code = await provider.getCode(contractAddress);

    console.log("Debug Info:");
    console.log("Connected Chain ID:", network.chainId.toString());
    console.log("Contract Address:", contractAddress);
    console.log("Contract Code Size:", code.length);

    alert(`Chain ID: ${network.chainId}\nCode Size: ${code.length}\n(Size 2 means empty/wrong network)`);
  }

  async function connectWallet() {
    console.log("Checking window.ethereum:", window.ethereum);
    if (!window.ethereum) {
      console.error("MetaMask not found!");
      return toast.error("MetaMask not detected. Try refreshing!");
    }

    await checkNetwork();

    try {
      const [account] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setWallet(account);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const votingContract = new ethers.Contract(contractAddress, contractABI, signer);
      setContract(votingContract);

      toast.success("Wallet connected!");
    } catch (err) {
      console.error("Connection Error:", err);
      toast.error("Connection failed: " + err.message);
    }
  }

  // ---------------- Remove Logic ----------------
  async function removeCandidate(id) {
    console.log("Attempting to remove candidate ID:", id);
    if (!contract) {
      console.error("Contract not loaded");
      return;
    }
    try {
      const tx = await contract.removeCandidate(id);
      console.log("Transaction sent:", tx);
      await tx.wait();
      console.log("Transaction confirmed");
      toast.success("Candidate removed");
      fetchCandidates();
    } catch (err) {
      console.error("Remove Candidate Error:", err);
      toast.error("Failed: " + (err.reason || err.message));
    }
  }



  // ---------------- Fetch Admin ----------------
  useEffect(() => {
    if (!contract) return;

    async function fetchAdmin() {
      const adminAddress = await contract.admin();
      setAdmin(adminAddress.toLowerCase());
    }

    fetchAdmin();
  }, [contract]);

  // ---------------- Fetch Voter Status ----------------
  async function checkVoterStatus() {
    if (!contract || !wallet) return;

    try {
      const voter = await contract.voters(wallet);

      if (!voter.registered) setStatus("Not Registered");
      else if (voter.voted) setStatus("Voted");
      else setStatus("Verified");
    } catch {
      setStatus("Unknown");
    }
  }

  useEffect(() => {
    if (wallet && contract) checkVoterStatus();
  }, [wallet, contract]);

  // ---------------- Candidate Management ----------------
  async function addCandidate() {
    if (!newCandidate.trim()) return toast.error("Enter candidate name");

    try {
      const tx = await contract.addCandidate(newCandidate);
      await tx.wait();
      toast.success("Candidate added!");
      setNewCandidate("");
      fetchCandidates();
    } catch {
      toast.error("Only admin can add candidates");
    }
  }

  async function fetchCandidates() {
    if (!contract) return;
    try {
      const count = await contract.candidatesCount();
      const list = [];

      for (let i = 1; i <= count; i++) {
        const [name, votes, active] = await contract.getCandidate(i);
        if (active) {
          list.push({ id: i, name, votes: Number(votes) });
        }
      }

      setCandidates(list);
    } catch (error) {
      console.error("Fetch Candidates Error:", error);
      toast.error("Error fetching: " + (error.reason || error.message));
    }
  }

  // ---------------- Voter Registration ----------------
  async function registerVoter() {
    if (!newVoter.trim()) return toast.error("Enter wallet address");

    try {
      const tx = await contract.registerVoter(newVoter);
      await tx.wait();

      toast.success("Voter registered");
      setNewVoter("");
    } catch {
      toast.error("Only admin can register voters!");
    }
  }

  async function registerBatchVoters() {
    if (!batchVoters.trim()) return toast.error("Enter comma-separated addresses");

    try {
      const list = batchVoters.split(",").map((a) => a.trim());

      for (let addr of list) {
        const tx = await contract.registerVoter(addr);
        await tx.wait();
      }

      toast.success("Batch registration done");
      setBatchVoters("");
    } catch {
      toast.error("Batch registration failed");
    }
  }



  // ---------------- SSI: Issue Verifiable Credential ----------------
  async function issueVC() {
    if (!wallet) return toast.error("Connect wallet first!");
    if (!contract) return toast.error("Contract not loaded");

    try {
      const signer = contract.runner;
      const credential = await generateVC(wallet, signer);
      setVC(credential);
      toast.success("SSI Credential Issued!");
    } catch (err) {
      console.error(err);
      toast.error("Error issuing VC");
    }
  }

  // ---------------- SSI Verification Before Voting ----------------
  async function vote(candidateId) {
    if (!vc) return toast.error("You must generate SSI credential first!");

    const valid = await verifyVC(vc, admin);

    if (!valid) return toast.error("SSI Verification Failed! VC Invalid.");

    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();

      toast.success("Vote submitted!");
      fetchCandidates();
      checkVoterStatus();
    } catch (err) {
      console.error("Voting Error:", err);
      // Try to extract the reason
      let reason = err.reason || err.shortMessage || err.message || "Unknown error";
      if (reason.includes("execution reverted")) {
        reason = reason.replace("execution reverted: ", "");
      }
      // Fallback for common errors if reason is messy
      if (reason.includes("Not registered")) reason = "Address not registered by Admin.";
      else if (reason.includes("Already voted")) reason = "You have already voted.";

      toast.error("Voting Failed: " + reason);
    }
  }

  // ---------------- Winner ----------------
  async function getWinner() {
    if (!contract) return;
    const name = await contract.getWinner();
    setWinner(name);
    toast.success("Winner Loaded");
  }

  const [voterToRemove, setVoterToRemove] = useState("");

  // ---------------- Render ----------------
  return (
    <div className="container">
      <h1 className="title">Blockchain Voting with SSI (DID + VC)</h1>

      {!wallet ? (
        <button className="btn connect main-connect-btn" onClick={connectWallet}>
          <span>🔌</span> Connect Wallet
        </button>
      ) : (
        <div className="wallet-info">
          <div
            className="wallet-address"
            onClick={() => { navigator.clipboard.writeText(wallet); toast.success("Address Copied!"); }}
            title="Click to copy full address"
          >
            <span>🟢</span> {wallet.slice(0, 6)}...{wallet.slice(-4)}
          </div>
          <span className={`role-badge ${wallet.toLowerCase() === admin ? "role-admin" : "role-voter"}`}>
            {wallet.toLowerCase() === admin ? "👑 Admin" : "👤 Voter"}
          </span>
        </div>
      )}

      <div className="control-buttons">
        <button className="btn fetch" onClick={fetchCandidates}>Fetch Candidates</button>
        <button className="btn winner" onClick={getWinner}>Get Winner</button>
        <button className="btn connect" onClick={issueVC}>Generate SSI Credential</button>
      </div>

      {vc && (
        <div className="vc-success-badge">
          ✅ SSI Credential Generated (stored locally)
        </div>
      )}

      {/* Candidate List */}
      <div className="candidate-list">
        {candidates.map((c) => (
          <div key={c.id} className="candidate-card">
            <h3>{c.name}</h3>
            <p>Votes: {c.votes}</p>
            <button className="btn vote" onClick={() => vote(c.id)}>
              Vote
            </button>
            {wallet.toLowerCase() === admin && (
              <button
                className="btn delete"
                style={{ backgroundColor: "#ff4444", marginTop: "10px" }}
                onClick={() => removeCandidate(c.id)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {winner && <h3 className="winner-name">Winner: {winner}</h3>}

      {/* Admin Panel */}
      {wallet && admin && wallet.toLowerCase() === admin && (
        <div className="admin-panel">
          <h2>Admin Panel</h2>

          <div className="admin-row">
            <div className="admin-box">
              <h3>Add Candidate</h3>
              <input value={newCandidate} onChange={(e) => setNewCandidate(e.target.value)} placeholder="Candidate Name" />
              <button className="btn register" onClick={addCandidate}>Add</button>
            </div>

            <div className="admin-box">
              <h3>Register Voter</h3>
              <input value={newVoter} onChange={(e) => setNewVoter(e.target.value)} placeholder="Wallet Address" />
              <button className="btn register" onClick={registerVoter}>Register</button>
            </div>

            <div className="admin-box">
              <h3>Batch Register</h3>
              <textarea value={batchVoters} onChange={(e) => setBatchVoters(e.target.value)} placeholder="addr1, addr2, ..." />
              <button className="btn register" onClick={registerBatchVoters}>Submit Batch</button>
            </div>


          </div>
        </div>
      )}

      <Toaster position="bottom-center" />
    </div>
  );
}

export default App;
