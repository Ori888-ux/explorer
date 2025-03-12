import { Address } from '@components/common/Address';
import { InspectorInstructionCard } from '@components/common/InspectorInstructionCard';
import {
    MessageCompiledInstruction,
    ParsedInstruction,
    PublicKey,
    SignatureResult,
    TransactionInstruction,
    VersionedMessage,
} from '@solana/web3.js';
import {
    parseCreateAssociatedTokenIdempotentInstruction,
    ParsedCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import React from 'react';

import { AddressFromLookupTableWithContext, AddressWithContext } from '../../../inspector/AddressWithContext';
import { fillAddressTableLookupsAccounts, findLookupAddress } from '../../../inspector/utils';
import { IInstruction, IAccountMeta } from 'web3js-experimental';

export function CreateIdempotentDetailsCard(props: {
    childIndex?: number;
    children?: React.ReactNode;
    index: number;
    info: ReturnType<typeof parseCreateAssociatedTokenIdempotentInstruction>;
    innerCards?: JSX.Element[];
    ix: ParsedInstruction;
    message?: VersionedMessage;
    raw: TransactionInstruction | MessageCompiledInstruction;
    result: SignatureResult;
    InstructionCardComponent?: React.FC<Parameters<typeof InspectorInstructionCard>[0]>;
}) {
    const {
        ix,
        index,
        info,
        raw,
        message,
        result,
        innerCards,
        childIndex,
        InstructionCardComponent = InspectorInstructionCard,
        instructionData,
    } = props;

    // console.log(8989, info, raw?.keys, raw?.accountKeyIndexes)
    console.log('ix data:', instructionData, info);
    console.log('how parse this?', info.accounts.payer);

    return (
        <InstructionCardComponent
            ix={ix}
            index={index}
            message={message}
            raw={raw}
            result={result}
            title="Associated Token Program: Create Idempotent"
            innerCards={innerCards}
            childIndex={childIndex}
        >
            <tr>
                <td>Payer</td>
                <td className="text-lg-end">
                    {/* {message && (
                        <AddressTableLookupAddress accountIndex={instructionData.accounts[0]} message={message} />
                    )} */}
                    <Address pubkey={new PublicKey(info.accounts.payer.pubkey.toBase58())} alignRight link />
                </td>
            </tr>
            {/*
            <tr>
                <td>Account</td>
                <td className="text-lg-end">
                    <Address pubkey={info.account} alignRight link />
                </td>
            </tr>

            <tr>
                <td>Wallet</td>
                <td className="text-lg-end">
                    <Address pubkey={info.wallet} alignRight link />
                </td>
            </tr>

            <tr>
                <td>Mint</td>
                <td className="text-lg-end">
                    <Address pubkey={info.mint} alignRight link />
                </td>
            </tr>

            <tr>
                <td>System Program</td>
                <td className="text-lg-end">
                    <Address pubkey={info.systemProgram} alignRight link />
                </td>
            </tr>

            <tr>
                <td>Token Program</td>
                <td className="text-lg-end">
                    <Address pubkey={info.tokenProgram} alignRight link />
                </td>
            </tr>*/}
        </InstructionCardComponent>
    );
}

function AddressTableLookupAddress({ accountIndex, message }: { accountIndex: number; message: VersionedMessage }) {
    const lookupsForAccountKeyIndex = fillAddressTableLookupsAccounts(message.addressTableLookups);
    const { lookup, dynamicLookups } = findLookupAddress(accountIndex, message, lookupsForAccountKeyIndex);

    return (
        <>
            {dynamicLookups.isStatic ? (
                <AddressWithContext pubkey={lookup} />
            ) : (
                <AddressFromLookupTableWithContext
                    lookupTableKey={dynamicLookups.lookups.lookupTableKey}
                    lookupTableIndex={dynamicLookups.lookups.lookupTableIndex}
                />
            )}
        </>
    );
}
