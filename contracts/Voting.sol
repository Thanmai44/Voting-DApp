// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    address public admin;
    bool public electionActive;

    struct Candidate {
        uint id;
        string name;
        uint voteCount;
        bool active;
    }

    struct Voter {
        bool registered;
        bool voted;
    }

    mapping(address => Voter) public voters;
    mapping(uint => Candidate) public candidates;
    mapping(string => bool) private candidateExists;
    uint public candidatesCount;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier electionOngoing() {
        require(electionActive, "Election not active");
        _;
    }

    function startElection() public onlyAdmin {
        electionActive = true;
    }

    function endElection() public onlyAdmin {
        electionActive = false;
    }

    function addCandidate(string memory _name) public onlyAdmin {
        require(!candidateExists[_name], "Candidate already exists");
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, true);
        candidateExists[_name] = true;
    }

    function removeCandidate(uint _id) public onlyAdmin {
        require(_id > 0 && _id <= candidatesCount, "Invalid candidate");
        require(candidates[_id].active, "Candidate already removed");
        
        candidates[_id].active = false;
        string memory name = candidates[_id].name;
        candidateExists[name] = false;
    }

    function registerVoter(address _voter) public onlyAdmin {
        voters[_voter].registered = true;
    }

    function vote(uint _candidateId) public electionOngoing {
        require(voters[msg.sender].registered, "Not registered");
        require(!voters[msg.sender].voted, "Already voted");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate");
        require(candidates[_candidateId].active, "Candidate is not active");

        voters[msg.sender].voted = true;
        candidates[_candidateId].voteCount++;
    }

    function getCandidate(uint _id) public view returns (string memory, uint, bool) {
        Candidate memory c = candidates[_id];
        return (c.name, c.voteCount, c.active);
    }

    function getWinner() public view returns (string memory) {
        uint maxVotes = 0;
        uint winnerId = 0;
        for (uint i = 1; i <= candidatesCount; i++) {
            if (candidates[i].active && candidates[i].voteCount > maxVotes) {
                maxVotes = candidates[i].voteCount;
                winnerId = i;
            }
        }
        if (winnerId == 0) return "No Winner";
        return candidates[winnerId].name;
    }
}
