import { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import abiFile from "./Voting.json";
import "./App.css";

// SSI Functions
import { generateVC, verifyVC } from "./ssi";

const contractAddress = "0xe9432c7Ac8e68022Dd971cD0cCB6b1Fcb73E098C";
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

  const [vc, setVC] = useState(null); // store verifiable credential

  // ---------------- Wallet ----------------
  async function connectWallet() {
    if (!window.ethereum) return toast.error("Install MetaMask");

    const [account] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    setWallet(account);

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const votingContract = new ethers.Contract(contractAddress, contractABI, signer);
    setContract(votingContract);

    toast.success("Wallet connected!");
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
        const [name, votes] = await contract.getCandidate(i);
        list.push({ id: i, name, votes: Number(votes) });
      }

      setCandidates(list);
    } catch {
      toast.error("Error fetching candidates");
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

    const credential = generateVC(wallet);
    setVC(credential);

    toast.success("SSI Credential Issued!");
  }

  // ---------------- SSI Verification Before Voting ----------------
  async function vote(candidateId) {
    if (!vc) return toast.error("You must generate SSI credential first!");

    const valid = verifyVC(vc);

    if (!valid) return toast.error("SSI Verification Failed!");

    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();

      toast.success("Vote submitted!");
      fetchCandidates();
      checkVoterStatus();
    } catch {
      toast.error("Voting failed. Already voted or not registered.");
    }
  }

  // ---------------- Winner ----------------
  async function getWinner() {
    if (!contract) return;
    const name = await contract.getWinner();
    setWinner(name);
    toast.success("Winner Loaded");
  }

  // ---------------- Render ----------------
  return (
    <div className="container">
      <h1 className="title">Blockchain Voting with SSI (DID + VC)</h1>

      {!wallet ? (
        <button className="btn connect" onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <p>Connected: {wallet.slice(0, 6)}...{wallet.slice(-4)}</p>
      )}

      <div className="control-buttons">
        <button className="btn fetch" onClick={fetchCandidates}>Fetch Candidates</button>
        <button className="btn winner" onClick={getWinner}>Get Winner</button>
        <button className="btn connect" onClick={issueVC}>Generate SSI Credential</button>
      </div>

      {vc && (
        <p style={{ color: "#00e676" }}>
          ✅ SSI Credential Generated (stored locally)
        </p>
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
          </div>
        ))}
      </div>

      {winner && <h3 className="winner-name">Winner: {winner}</h3>}

      {/* Admin Panel */}
      {wallet.toLowerCase() === admin && (
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
