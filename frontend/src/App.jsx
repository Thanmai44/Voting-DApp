import { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import abiFile from "./Voting.json";
import "./App.css";

import { generateVC, verifyVC } from "./ssi";

const contractAddress = "0x43e315Ad75b0b0219cd007749eF05013c46e3798";
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

  const [electionStarted, setElectionStarted] = useState(false);
  const [electionEndTime, setElectionEndTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [isElectionActive, setIsElectionActive] = useState(false);

  const [vc, setVC] = useState(null);

  async function checkNetwork() {
    if (!window.ethereum) return;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0xaa36a7") {
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

  async function connectWallet() {
    if (!window.ethereum) return toast.error("MetaMask not detected!");
    await checkNetwork();

    try {
      const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(account);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const votingContract = new ethers.Contract(contractAddress, contractABI, signer);
      setContract(votingContract);

      toast.success("Wallet connected!");
    } catch (err) {
      console.error(err);
      toast.error("Connection failed");
    }
  }

  async function fetchElectionStatus() {
    if (!contract) return;
    try {
      const started = await contract.electionStarted();
      const endTime = await contract.electionEndTime();

      setElectionStarted(started);
      setElectionEndTime(Number(endTime));
    } catch (error) {
      console.error("Status Error:", error);
    }
  }

  useEffect(() => {
    if (contract) {
      fetchElectionStatus();
      const interval = setInterval(fetchElectionStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [contract]);

  useEffect(() => {
    if (!electionStarted || !electionEndTime) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = electionEndTime - now;

      if (remaining > 0) {
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        setIsElectionActive(true);
      } else {
        setTimeLeft("Election Ended");
        setIsElectionActive(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [electionStarted, electionEndTime]);

  async function startElection() {
    if (!contract) return;
    try {
      const tx = await contract.startElection();
      await tx.wait();
      toast.success("Election Started! (12 Hours)");
      fetchElectionStatus();
    } catch (error) {
      console.error(error);
      toast.error("Failed to start election");
    }
  }

  async function removeCandidate(id) {
    if (!contract) return;
    if (electionStarted) return toast.error("Cannot remove after election started");
    try {
      const tx = await contract.removeCandidate(id);
      await tx.wait();
      toast.success("Candidate removed");
      fetchCandidates();
    } catch (err) {
      console.error(err);
      toast.error("Failed: " + (err.reason || "Error"));
    }
  }

  useEffect(() => {
    if (!contract) return;
    async function fetchAdmin() {
      try {
        const adminAddress = await contract.admin();
        setAdmin(adminAddress.toLowerCase());
      } catch (e) { console.error(e); }
    }
    fetchAdmin();
  }, [contract]);

  async function checkVoterStatus() {
    if (!contract || !wallet) return;
    try {
      const voter = await contract.voters(wallet);
      if (!voter.registered) setStatus("Not Registered");
      else if (voter.voted) setStatus("Voted");
      else setStatus("Verified");
    } catch { setStatus("Unknown"); }
  }

  useEffect(() => { if (wallet && contract) checkVoterStatus(); }, [wallet, contract]);

  async function addCandidate() {
    if (!newCandidate.trim()) return toast.error("Enter name");
    if (electionStarted) return toast.error("Cannot add after election started");
    try {
      const tx = await contract.addCandidate(newCandidate);
      await tx.wait();
      toast.success("Candidate added!");
      setNewCandidate("");
      fetchCandidates();
    } catch { toast.error("Error adding candidate"); }
  }

  async function fetchCandidates() {
    if (!contract) return;
    try {
      const count = await contract.candidatesCount();
      const list = [];
      for (let i = 1; i <= count; i++) {
        const [name, votes, active] = await contract.getCandidate(i);
        if (active) list.push({ id: i, name, votes: Number(votes) });
      }
      setCandidates(list);
    } catch (error) { console.error(error); }
  }

  async function registerVoter() {
    if (!newVoter.trim()) return toast.error("Enter address");
    try {
      const tx = await contract.registerVoter(newVoter);
      await tx.wait();
      toast.success("Voter registered");
      setNewVoter("");
    } catch { toast.error("Error registering"); }
  }

  async function registerBatchVoters() {
    if (!batchVoters.trim()) return toast.error("Enter addresses");
    try {
      const list = batchVoters.split(",").map((a) => a.trim());
      for (let addr of list) {
        const tx = await contract.registerVoter(addr);
        await tx.wait();
      }
      toast.success("Batch done");
      setBatchVoters("");
    } catch { toast.error("Batch failed"); }
  }

  async function issueVC() {
    if (!wallet || !contract) return toast.error("Connect wallet first!");
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

  async function vote(candidateId) {
    if (!vc) return toast.error("Generate SSI credential first!");
    if (!isElectionActive) return toast.error("Election is not active!");

    const valid = await verifyVC(vc, admin);
    if (!valid) return toast.error("SSI Verification Failed!");

    try {
      const tx = await contract.vote(candidateId);
      await tx.wait();
      toast.success("Vote submitted!");
      fetchCandidates();
      checkVoterStatus();
    } catch (err) {
      console.error("Voting Error:", err);
      let reason = err.reason || "Voting Failed";
      if (reason.includes("execution reverted")) reason = reason.replace("execution reverted: ", "");
      toast.error(reason);
    }
  }

  async function getWinner() {
    if (!contract) return;
    if (isElectionActive) return toast.error("Wait for election to end!");
    try {
      const name = await contract.getWinner();
      if (name === "No Winner") return toast("No votes cast yet");
      setWinner(name);
      toast.success("Winner Loaded");
    } catch (e) { console.error(e); toast.error("Error getting winner"); }
  }

  return (
    <div className="container">
      <h1 className="title">Blockchain Voting with SSI (DID + VC)</h1>

      {!wallet ? (
        <button className="btn connect main-connect-btn" onClick={connectWallet}>
          <span>🔌</span> Connect Wallet
        </button>
      ) : (
        <div className="wallet-info">
          <div className="wallet-address" onClick={() => { navigator.clipboard.writeText(wallet); toast.success("Address Copied!"); }} title="Copy">
            <span>🟢</span> {wallet.slice(0, 6)}...{wallet.slice(-4)}
          </div>
          <span className={`role-badge ${wallet.toLowerCase() === admin ? "role-admin" : "role-voter"}`}>
            {wallet.toLowerCase() === admin ? "👑 Admin" : "👤 Voter"}
          </span>
        </div>
      )}

      {
      electionStarted && (
        <div className="timer-container" style={{ margin: "2rem 0", fontSize: "1.5rem", fontWeight: "bold", color: isElectionActive ? "var(--primary)" : "var(--accent)" }}>
          {isElectionActive ? `⏳ Time Left: ${timeLeft}` : "🏁 Election Ended"}
        </div>
      )}

      <div className="control-buttons">
        {wallet && admin && wallet.toLowerCase() === admin && !electionStarted && (
          <button className="btn connect" onClick={startElection}>🚀 Start Election (12h)</button>
        )}

        <button className="btn fetch" onClick={fetchCandidates}>Fetch Candidates</button>

        {(!electionStarted || !isElectionActive) && (
          <button className="btn winner" onClick={getWinner} disabled={isElectionActive}>Get Winner</button>
        )}

        <button className="btn connect" onClick={issueVC}>Generate SSI Credential</button>
      </div>

      {vc && <div className="vc-success-badge">✅ SSI Credential Generated</div>}

      <div className="candidate-list">
        {candidates.map((c) => (
          <div key={c.id} className="candidate-card">
            <h3>{c.name}</h3>
            {wallet.toLowerCase() === admin && <p>Votes: {c.votes}</p>}

            {isElectionActive && (
              <button className="btn vote" onClick={() => vote(c.id)}>Vote</button>
            )}

            {wallet.toLowerCase() === admin && !electionStarted && (
              <button className="btn delete" onClick={() => removeCandidate(c.id)}>Remove</button>
            )}
          </div>
        ))}
      </div>

      {winner && <h3 className="winner-name">Winner: {winner}</h3>}

      {wallet && admin && wallet.toLowerCase() === admin && (
        <div className="admin-panel">
          <h2>Admin Panel</h2>
          <div className="admin-row">
            <div className="admin-box">
              <h3>Add Candidate</h3>
              <input value={newCandidate} onChange={(e) => setNewCandidate(e.target.value)} placeholder="Name" />
              <button className="btn register" onClick={addCandidate} disabled={electionStarted}>Add</button>
            </div>
            <div className="admin-box">
              <h3>Register Voter</h3>
              <input value={newVoter} onChange={(e) => setNewVoter(e.target.value)} placeholder="Address" />
              <button className="btn register" onClick={registerVoter}>Register</button>
            </div>
            <div className="admin-box">
              <h3>Batch Register</h3>
              <textarea value={batchVoters} onChange={(e) => setBatchVoters(e.target.value)} placeholder="addr1, addr2" />
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
