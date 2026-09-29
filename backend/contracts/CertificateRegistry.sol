// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateRegistry is Ownable {

    struct Certificate {
        bytes32 certificateHash;
        address issuer;
        uint256 timestamp;
        bool exists;
    }

    mapping(string => Certificate) private certificates;

    event CertificateRegistered(
        string indexed certificateId,
        bytes32 certificateHash,
        address indexed issuer,
        uint256 timestamp
    );

    event CertificateRevoked(
        string indexed certificateId,
        address indexed issuer,
        uint256 timestamp
    );

    constructor(address initialOwner)
        Ownable(initialOwner)
    {}

    function registerCertificate(
        string calldata certificateId,
        bytes32 certificateHash
    ) external onlyOwner {

        require(
            bytes(certificateId).length > 0,
            "Invalid certificate ID"
        );

        require(
            certificateHash != bytes32(0),
            "Invalid certificate hash"
        );

        require(
            !certificates[certificateId].exists,
            "Certificate already exists"
        );

        certificates[certificateId] = Certificate({
            certificateHash: certificateHash,
            issuer: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit CertificateRegistered(
            certificateId,
            certificateHash,
            msg.sender,
            block.timestamp
        );
    }

    function getCertificate(
        string calldata certificateId
    )
        external
        view
        returns (
            bytes32 certificateHash,
            address issuer,
            uint256 timestamp,
            bool exists
        )
    {
        Certificate memory certificate =
            certificates[certificateId];

        return (
            certificate.certificateHash,
            certificate.issuer,
            certificate.timestamp,
            certificate.exists
        );
    }

    function verifyCertificate(
        string calldata certificateId,
        bytes32 certificateHash
    )
        external
        view
        returns (bool)
    {
        Certificate memory certificate =
            certificates[certificateId];

        return (
            certificate.exists &&
            certificate.certificateHash == certificateHash
        );
    }

    function certificateExists(
        string calldata certificateId
    )
        external
        view
        returns (bool)
    {
        return certificates[certificateId].exists;
    }

    function revokeCertificate(
        string calldata certificateId
    )
        external
        onlyOwner
    {
        require(
            certificates[certificateId].exists,
            "Certificate does not exist"
        );

        certificates[certificateId].exists = false;

        emit CertificateRevoked(
            certificateId,
            msg.sender,
            block.timestamp
        );
    }
}