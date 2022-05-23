import { Program, web3 } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import {
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    ParsedAccountData,
    TransactionInstruction,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, AccountLayout, MintLayout, ASSOCIATED_TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";

import fs from 'fs';
import { TokenList } from './types';
import { publicKey } from '@project-serum/anchor/dist/cjs/utils';
// import { Raffle } from '../target/types/raffle';


const PROGRAM_ID = "6gN1UbdvbuFr1vLfa7srVvDutoM4t9FzWsoZrMBFDyXL";
const TREASURY_WALLET = new PublicKey("32NL69SFk8GLPFZfKQwsuexcXHd7rqAQn1mrasF1ksVj");

const LIST_SIZE = 96;
const DECIMALS = 1000000000;

anchor.setProvider(anchor.Provider.local(web3.clusterApiUrl('devnet')));
const solConnection = anchor.getProvider().connection;
const payer = anchor.getProvider().wallet;
console.log(payer.publicKey.toBase58());

const idl = JSON.parse(
    fs.readFileSync(__dirname + "/raffle.json", "utf8")
);

let program: Program = null;

// Address of the deployed program.
const programId = new anchor.web3.PublicKey(PROGRAM_ID);

// Generate the program client from IDL.
program = new anchor.Program(idl, programId);
console.log('ProgramId: ', program.programId.toBase58());

const main = async () => {

    // await createRaffle(payer.publicKey, new PublicKey("GF4XmpVKCf9aozU5igmr9sKNzDBkjvmiWujx8uC7Bnp4"), 1, 0, 0, 1652076787, 1, 1, 100);
    // await updateRafflePeriod(payer.publicKey, new PublicKey("HyomvqtLBjHhPty1P6dKzNf5gNow9qbfGkxj69pqBD8Z"), 1649355012);
    // await buyTicket(payer.publicKey, new PublicKey("14njy5aKYoAvz3Ut8ojfYULhEKbBDXcXidZ3xK6jZs7U"), 10);
    // await revealWinner(payer.publicKey, new PublicKey("14njy5aKYoAvz3Ut8ojfYULhEKbBDXcXidZ3xK6jZs7U"));
    // await claimReward(payer.publicKey, new PublicKey("14njy5aKYoAvz3Ut8ojfYULhEKbBDXcXidZ3xK6jZs7U"));
    // await withdrawNft(payer.publicKey, new PublicKey("GF4XmpVKCf9aozU5igmr9sKNzDBkjvmiWujx8uC7Bnp4"));
    // const pool = await getRaffleState(new PublicKey("5E5PGFEhgN2hFq488ERAA1Lm4xyUJifxRDKGE5172gg1"));
    // console.log(pool.endTimestamp.toNumber());
}

export const listToken = async (
    userAddress: PublicKey,
    tokenMint: PublicKey,
    price: number,
    amount: number
) => {
    const [tokenList, bump] = await PublicKey.findProgramAddress(
        [userAddress.toBytes(), tokenMint.toBytes()],
        program.programId
    );

    let listerTokenAccount = await getAssociatedTokenAccount(userAddress, tokenMint);
    let { instructions, destinationAccounts } = await getATokenAccountsNeedCreate(
        solConnection,
        userAddress,
        tokenList,
        [tokenMint]
    );

    let TOKEN_DECIMALS = await getDecimals(userAddress, tokenMint);

    let tx;

    if (instructions.length === 0) {
        tx = await program.rpc.listToken(
            bump,
            new anchor.BN(price * DECIMALS),
            new anchor.BN(amount),
            new anchor.BN(TOKEN_DECIMALS), {
            accounts: {
                lister: userAddress,
                tokenList,
                tokenMint,
                listerTokenAccount,
                vaultAccount: destinationAccounts[0],
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            },
            instructions: [],
            signers: [],
        });
    } else {
        tx = await program.rpc.listToken(
            bump,
            new anchor.BN(price * DECIMALS),
            new anchor.BN(amount),
            new anchor.BN(TOKEN_DECIMALS), {
            accounts: {
                lister: userAddress,
                tokenList,
                tokenMint,
                listerTokenAccount,
                vaultAccount: destinationAccounts[0],
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            },
            instructions: [
                ...instructions,
            ],
            signers: [],
        });
    }
    await solConnection.confirmTransaction(tx, "finalized");
    console.log("txHash = ", tx);
}

export const delist = async (
    userAddress: PublicKey,
    tokenListkey: PublicKey,
) => {
    const state: TokenList = await getStateByKey(tokenListkey);
    let tokenMint = state.tokenAddress;
    const [tokenListK, bump] = await PublicKey.findProgramAddress(
        [userAddress.toBytes(), tokenMint.toBytes()],
        program.programId
    );

    let listerTokenAccount = await getAssociatedTokenAccount(userAddress, tokenMint);
    let vaultAccount = await getAssociatedTokenAccount(tokenListkey, tokenMint);

    const tx = await program.rpc.delist(
        bump, {
        accounts: {
            lister: userAddress,
            tokeList: tokenListkey,
            listerTokenAccount,
            vaultAccount,
            tokenMint,
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [],
        signers: [],
    });
    await solConnection.confirmTransaction(tx, "finalized");
    console.log("txHash = ", tx);
}

export const update = async (
    userAddress: PublicKey,
    tokenListkey: PublicKey,
    newAmount: number,
) => {
    const state: TokenList = await getStateByKey(tokenListkey);
    let tokenMint = state.tokenAddress;
    const [tokenListK, bump] = await PublicKey.findProgramAddress(
        [userAddress.toBytes(), tokenMint.toBytes()],
        program.programId
    );
    let listerTokenAccount = await getAssociatedTokenAccount(userAddress, tokenMint);
    let vaultAccount = await getAssociatedTokenAccount(tokenListkey, tokenMint);

    const tx = await program.rpc.update(
        bump, new anchor.BN(newAmount), {
        accounts: {
            lister: userAddress,
            tokeList: tokenListkey,
            tokenMint,
            listerTokenAccount,
            vaultAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [],
        signers: [],
    });
    await solConnection.confirmTransaction(tx, "finalized");
    console.log("txHash = ", tx);
}

export const buy = async (
    userAddress: PublicKey,
    tokenListkey: PublicKey,
    creatorAddress: PublicKey,
    artistFee: number,
    amount: number
) => {
    const state: TokenList = await getStateByKey(tokenListkey);
    let tokenMint = state.tokenAddress;
    let lister = state.lister;
    const [tokenListK, bump] = await PublicKey.findProgramAddress(
        [lister.toBytes(), tokenMint.toBytes()],
        program.programId
    );
    let buyerTokenAccount = await getAssociatedTokenAccount(userAddress, tokenMint);
    let vaultAccount = await getAssociatedTokenAccount(tokenListkey, tokenMint);

    const tx = await program.rpc.buy(
        bump, new anchor.BN(artistFee), new anchor.BN(amount), {
        accounts: {
            buyer: userAddress,
            tokeList: tokenListkey,
            buyerTokenAccount,
            vaultAccount,
            tokenMint,
            lister,
            creator: creatorAddress,
            treasuryWallet: TREASURY_WALLET,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        },
        instructions: [],
        signers: [],
    });
    await solConnection.confirmTransaction(tx, "finalized");
    console.log("txHash = ", tx);

}

export const getStateByKey = async (
    tokenListKey: PublicKey
): Promise<TokenList | null> => {
    try {
        let listState = await program.account.tokenlist.fetch(tokenListKey);
        return listState as TokenList;
    } catch {
        return null;
    }
}

export const getDecimals = async (owner: PublicKey, tokenMint: PublicKey): Promise<number | null> => {
    try {
        let ownerTokenAccount = await getAssociatedTokenAccount(owner, tokenMint);
        const tokenAccount = await solConnection.getParsedAccountInfo(ownerTokenAccount);
        let decimal = (tokenAccount.value?.data as ParsedAccountData).parsed.info.tokenAmount.decimals;
        let DECIMALS = Math.pow(10, decimal);
        return DECIMALS;
    } catch {
        return null;
    }
}
const getAssociatedTokenAccount = async (ownerPubkey: PublicKey, mintPk: PublicKey): Promise<PublicKey> => {
    let associatedTokenAccountPubkey = (await PublicKey.findProgramAddress(
        [
            ownerPubkey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintPk.toBuffer(), // mint address
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    ))[0];
    return associatedTokenAccountPubkey;
}

export const getATokenAccountsNeedCreate = async (
    connection: anchor.web3.Connection,
    walletAddress: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey,
    nfts: anchor.web3.PublicKey[],
) => {
    let instructions = [], destinationAccounts = [];
    for (const mint of nfts) {
        const destinationPubkey = await getAssociatedTokenAccount(owner, mint);
        let response = await connection.getAccountInfo(destinationPubkey);
        if (!response) {
            const createATAIx = createAssociatedTokenAccountInstruction(
                destinationPubkey,
                walletAddress,
                owner,
                mint,
            );
            instructions.push(createATAIx);
        }
        destinationAccounts.push(destinationPubkey);
        if (walletAddress != owner) {
            const userAccount = await getAssociatedTokenAccount(walletAddress, mint);
            response = await connection.getAccountInfo(userAccount);
            if (!response) {
                const createATAIx = createAssociatedTokenAccountInstruction(
                    userAccount,
                    walletAddress,
                    walletAddress,
                    mint,
                );
                instructions.push(createATAIx);
            }
        }
    }
    return {
        instructions,
        destinationAccounts,
    };
}

export const createAssociatedTokenAccountInstruction = (
    associatedTokenAddress: anchor.web3.PublicKey,
    payer: anchor.web3.PublicKey,
    walletAddress: anchor.web3.PublicKey,
    splTokenMintAddress: anchor.web3.PublicKey
) => {
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
        { pubkey: walletAddress, isSigner: false, isWritable: false },
        { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
        {
            pubkey: anchor.web3.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
            pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];
    return new anchor.web3.TransactionInstruction({
        keys,
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.from([]),
    });
}

main()