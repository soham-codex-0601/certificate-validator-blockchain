// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;


/**
 * CertiChain Certificate Registry
 *
 * Stores certificate fingerprints on Ethereum Sepolia.
 *
 * The actual certificate PDF/image is NOT stored on-chain.
 *
 * Only the SHA-256 fingerprint, certificate ID,
 * issuer wallet and timestamp are stored.
 */
contract CertificateRegistry {

    address public owner;


    struct Certificate {

        bytes32 certificateHash;

        address issuer;

        uint256 timestamp;

        bool exists;

        bool revoked;
    }


    mapping(
        string => Certificate
    ) private certificates;


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


    modifier onlyOwner() {

        require(
            msg.sender == owner,
            "Only contract owner"
        );

        _;
    }


    constructor() {

        owner = msg.sender;
    }


    /**
     * Register a certificate.
     *
     * Only the contract owner can register certificates.
     *
     * In CertiChain, the contract owner is the
     * institution's MetaMask wallet.
     */
    function registerCertificate(

        string calldata certificateId,

        bytes32 certificateHash

    )
        external
        onlyOwner
    {

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

            exists: true,

            revoked: false
        });


        emit CertificateRegistered(

            certificateId,

            certificateHash,

            msg.sender,

            block.timestamp
        );
    }


    /**
     * Retrieve certificate information.
     */
    function getCertificate(

        string calldata certificateId

    )
        external
        view

        returns (

            bytes32 certificateHash,

            address issuer,

            uint256 timestamp,

            bool exists,

            bool revoked
        )
    {

        Certificate memory certificate =
            certificates[certificateId];


        return (

            certificate.certificateHash,

            certificate.issuer,

            certificate.timestamp,

            certificate.exists,

            certificate.revoked
        );
    }


    /**
     * Verify certificate directly on-chain.
     */
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

            !certificate.revoked &&

            certificate.certificateHash
                == certificateHash
        );
    }


    /**
     * Check whether certificate exists.
     */
    function certificateExists(

        string calldata certificateId

    )
        external
        view

        returns (bool)
    {

        return certificates[
            certificateId
        ].exists;
    }


    /**
     * Revoke a certificate.
     */
    function revokeCertificate(

        string calldata certificateId

    )
        external
        onlyOwner
    {

        require(

            certificates[
                certificateId
            ].exists,

            "Certificate does not exist"
        );


        require(

            !certificates[
                certificateId
            ].revoked,

            "Certificate already revoked"
        );


        certificates[
            certificateId
        ].revoked = true;


        emit CertificateRevoked(

            certificateId,

            msg.sender,

            block.timestamp
        );
    }


    /**
     * Transfer contract ownership.
     */
    function transferOwnership(

        address newOwner

    )
        external
        onlyOwner
    {

        require(

            newOwner != address(0),

            "Invalid owner"
        );


        owner = newOwner;
    }
}