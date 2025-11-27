import { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import abiFile from "./Voting.json";
import "./App.css";

const contractAddress = "0xEc90Ac0f5907506d60Ed4586bD3e2b93F00Aa1cF";
const ADMIN_ADDRESS = "0x3134C9D21Fc91Eddf11c797AAE262f5f820B9C37";
const contractABI = abiFile.abi;

function App() {
  const [wallet, setWallet] = useState("");
  const [contract, setContract] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [winner, setWinner] = useState("");
  const [newVoter, setNewVoter] = useState("");
  const [newCandidate, setNewCandidate] = useState("");
  const [status, setStatus] = useState("");
  const [batchVoters, setBatchVoters] = useState("");

  // ---------------- Wallet ----------------
  async function connectWallet() {
    if (!window.ethereum) return toast.error("Install MetaMask");
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setWallet(account);

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const votingContract = new ethers.Contract(contractAddress, contractABI, signer);
    setContract(votingContract);

    toast.success("Wallet connected!");
  }

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

  // ---------------- Voter Registration ----------------
  async function registerVoter() {
    if (!newVoter.trim()) return toast.error("Enter a valid address");
    try {
      const tx = await contract.registerVoter(newVoter);
      await tx.wait();
      toast.success("Voter registered successfully!");
      setNewVoter("");
    } catch {
      toast.error("Only admin can register voters!");
    }
  }

  // ---------------- Batch Registration ----------------
  async function registerBatchVoters() {
    if (!batchVoters.trim()) return toast.error("Enter wallet addresses separated by commas");
    const addresses = batchVoters.split(",").map((addr) => addr.trim());
    try {
      for (let addr of addresses) {
        const tx = await contract.registerVoter(addr);
        await tx.wait();
      }
      toast.success("Batch registration complete!");
      setBatchVoters("");
    } catch (err) {
      console.error(err);
      toast.error("Batch registration failed. Only admin allowed!");
    }
  }

  // ---------------- Candidate Management ----------------
  async function addCandidate() {
    if (!newCandidate.trim()) return toast.error("Enter a candidate name");
    try {
      const tx = await contract.addCandidate(newCandidate);
      await tx.wait();
      toast.success(`Candidate '${newCandidate}' added`);
      setNewCandidate("");
      fetchCandidates();
    } catch {
      toast.error("Only admin can add candidates!");
    }
  }

  // ---------------- Fetch Candidates ----------------
  async function fetchCandidates() {
    if (!contract) return;
    try {
      const count = await contract.candidatesCount();
      const list = [];
      for (let i = 1; i <= count; i++) {
        const [name, votes] = await contract.getCandidate(i);
        list.push({ id: i, name, votes: Number(votes) });
      }
      setCandidates(list);
    } catch {
      toast.error("Error fetching candidates");
    }
  }

  // ---------------- SSI Verification ----------------
  async function verifySSI() {
    const code = prompt("Enter SSI verification code:");
    return code === "VALID-SSI-2025";
  }

  // ---------------- Voting ----------------
  async function vote(candidateId) {
    if (!contract) return toast.error("Connect wallet first");
    const verified = await verifySSI();
    if (!verified) return toast.error("SSI verification failed!");
    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();
      toast.success("Vote submitted!");
      fetchCandidates();
      checkVoterStatus();
    } catch {
      toast.error("Already voted or not registered!");
    }
  }

  // ---------------- Winner ----------------
  async function getWinner() {
    if (!contract) return;
    const name = await contract.getWinner();
    setWinner(name);
    toast.success("Winner fetched!");
  }

  // ---------------- Render ----------------
  return (
    <div className="container">
      <h1 className="title">Blockchain Voting (SSI Prototype)</h1>

      {!wallet ? (
        <button className="btn connect" onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div className="wallet-info">
          <p>Connected: {wallet.slice(0, 6)}...{wallet.slice(-4)}</p>
          <p className={`voter-status ${status.toLowerCase()}`}>Status: {status}</p>
        </div>
      )}

      <div className="control-buttons">
        <button className="btn fetch" onClick={fetchCandidates}>Fetch Candidates</button>
        <button className="btn winner" onClick={getWinner}>Get Winner</button>
      </div>

      <div className="candidate-list">
        {candidates.map((c) => (
          <div key={c.id} className="candidate-card">
            <h3>{c.name}</h3>
            <p>Votes: {c.votes}</p>
            <button className="btn vote" onClick={() => vote(c.id)}>Vote</button>
          </div>
        ))}
      </div>

      {winner && <h3 className="winner-name">🏆 Winner: {winner}</h3>}

      {/* -------- ADMIN PANEL -------- */}
      {wallet.toLowerCase() === ADMIN_ADDRESS.toLowerCase() && (
        <div className="admin-panel">
          <h2>Admin Control Panel</h2>

          <div className="admin-row">
            <div className="admin-box">
              <h3>Add Candidate</h3>
              <input
                type="text"
                placeholder="Enter candidate name"
                value={newCandidate}
                onChange={(e) => setNewCandidate(e.target.value)}
              />
              <button className="btn register" onClick={addCandidate}>Add Candidate</button>
            </div>

            <div className="register-box">
              <h3>Register a Voter</h3>
              <input
                type="text"
                placeholder="Enter voter wallet address"
                value={newVoter}
                onChange={(e) => setNewVoter(e.target.value)}
              />
              <button className="btn register" onClick={registerVoter}>Register Voter</button>
            </div>

            <div className="register-box">
              <h3>Batch Register Voters</h3>
              <textarea
                placeholder="Paste wallet addresses separated by commas"
                value={batchVoters}
                onChange={(e) => setBatchVoters(e.target.value)}
              />
              <button className="btn register" onClick={registerBatchVoters}>Register Batch</button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="bottom-center" />
    </div>
  );
}

export default App;
