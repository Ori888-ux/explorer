'use client';

import { useHotkeys } from '@mantine/hooks';
import { useCluster } from '@providers/cluster';
import { VersionedMessage } from '@solana/web3.js';
import { Cluster } from '@utils/cluster';
import { SearchElement } from '@utils/token-search';
import bs58 from 'bs58';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { MouseEventHandler, TouchEventHandler, useCallback, useId, useMemo, useRef } from 'react';
import { Search, X } from 'react-feather';
import { ActionMeta, components, ControlProps, InputActionMeta, SelectInstance } from 'react-select';
import AsyncSelect from 'react-select/async';

import FEATURES from '@/app/utils/feature-gate/featureGates.json';

import { FetchedDomainInfo } from '../api/domain-info/[domain]/route';
import { FeatureInfoType } from '../utils/feature-gate/types';
import { LOADER_IDS, LoaderName, PROGRAM_INFO_BY_ID, SPECIAL_IDS, SYSVAR_IDS } from '../utils/programs';
import { searchTokens } from '../utils/token-search';
import { useDebouncedAsync } from '../utils/use-debounce-async';
import { MIN_MESSAGE_LENGTH } from './inspector/RawInputCard';

interface SearchOptions {
    label: string;
    options: SearchElement[];
}

const hasDomainSyntax = (value: string) => {
    return value.length > 3 && value.split('.').length === 2;
};

const RESET_VALUE = '' as any;

export function SearchBar() {
    const [search, setSearch] = React.useState('');
    const router = useRouter();
    const { cluster, clusterInfo } = useCluster();
    const searchParams = useSearchParams();
    const selectRef = useRef<SelectInstance<SearchElement> | null>(null);

    const onChange = (option: SearchElement, meta: ActionMeta<any>) => {
        if (option === null || typeof option?.pathname !== 'string') {
            setSearch('');
            return;
        }
        const { pathname } = option;
        if (meta.action === 'select-option') {
            // Always use the pathname directly if it contains query params
            if (pathname.includes('?')) {
                router.push(pathname);
            } else {
                // Only preserve existing query params for paths without their own params
                const nextQueryString = searchParams?.toString();
                router.push(`${pathname}${nextQueryString ? `?${nextQueryString}` : ''}`);
            }
            setSearch('');
        }
    };

    const onInputChange = useCallback((value: string, { action }: InputActionMeta) => {
        if (action === 'input-change') {
            setSearch(value);
        }
    }, []);

    async function performSearch(search: string): Promise<SearchOptions[]> {
        const localOptions = buildOptions(search, cluster, clusterInfo?.epochInfo.epoch);
        const [tokenOptions, domainOptions] = await Promise.allSettled([
            buildTokenOptions(search, cluster),
            // buildFeatureOptions(search),
            hasDomainSyntax(search) && cluster === Cluster.MainnetBeta ? buildDomainOptions(search) : [],
        ]);

        const tokenOptionsAppendable = buildAppendableSearchOptions(tokenOptions, 'token');
        // const featureOptionsAppendable = buildAppendableSearchOptions(featureOptions, 'feature gates');
        const domainOptionsAppendable = buildAppendableSearchOptions(domainOptions, 'domain');

        return [...localOptions, ...domainOptionsAppendable, ...tokenOptionsAppendable];
    }

    const debouncedPerformSearch = useDebouncedAsync(performSearch, 500);

    // Substitute control component to insert custom clear button (the built in clear button only works with selected option, which is not the case)
    const Control = useMemo(
        () =>
            function ControlSubstitute({ children, ...props }: ControlProps<SearchElement, false>) {
                const clearHandler = useCallback(
                    (e: React.MouseEvent<HTMLDivElement, globalThis.MouseEvent> | React.TouchEvent<HTMLDivElement>) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSearch('');
                        selectRef.current?.clearValue();
                        selectRef.current?.blur();
                    },
                    []
                );
                const hasValue = Boolean(selectRef.current?.inputRef?.value);

                return (
                    <components.Control {...props}>
                        <Search className="me-3" size={15} />
                        {children}
                        {hasValue ? (
                            <ClearIndicator onClick={clearHandler} onTouchStart={clearHandler} />
                        ) : (
                            <KeyIndicator />
                        )}
                    </components.Control>
                );
            },
        [setSearch, selectRef]
    );

    const onHotKeyPressHandler = useCallback(() => {
        selectRef.current?.focus();
    }, []);

    // Focus search on hotkey press
    useHotkeys(
        [
            ['/', onHotKeyPressHandler],
            ['mod+k', onHotKeyPressHandler],
        ],
        ['INPUT', 'TEXTAREA']
    );

    const noOptionsMessageHandler = useCallback(() => 'No Results', []);
    const loadingMessageHandler = useCallback(() => 'loading...', []);
    const id = useId();

    return (
        <div className="w-100">
            <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={debouncedPerformSearch}
                autoFocus
                ref={selectRef}
                inputId={id}
                noOptionsMessage={noOptionsMessageHandler}
                loadingMessage={loadingMessageHandler}
                placeholder="Search for blocks, accounts, transactions, programs, and tokens"
                value={RESET_VALUE}
                inputValue={search}
                blurInputOnSelect
                onChange={onChange}
                styles={{
                    control: style => ({ ...style, pointerEvents: 'all' }),
                    input: style => ({ ...style, width: '100%' }),
                    /* work around for https://github.com/JedWatson/react-select/issues/3857 */
                    placeholder: style => ({ ...style, pointerEvents: 'none' }),
                }}
                onInputChange={onInputChange}
                components={{ Control, DropdownIndicator: undefined, IndicatorSeparator: undefined }}
                classNamePrefix="search-bar"
            />
        </div>
    );
}

function buildProgramOptions(search: string, cluster: Cluster) {
    const matchedPrograms = Object.entries(PROGRAM_INFO_BY_ID).filter(([address, { name, deployments }]) => {
        if (!deployments.includes(cluster)) return false;
        return name.toLowerCase().includes(search.toLowerCase()) || address.includes(search);
    });

    if (matchedPrograms.length > 0) {
        return {
            label: 'Programs',
            options: matchedPrograms.map(([address, { name }]) => ({
                label: name,
                pathname: '/address/' + address,
                value: [name, address],
            })),
        };
    }
}

const SEARCHABLE_LOADERS: LoaderName[] = ['BPF Loader', 'BPF Loader 2', 'BPF Upgradeable Loader'];

function buildLoaderOptions(search: string) {
    const matchedLoaders = Object.entries(LOADER_IDS).filter(([address, name]) => {
        return (
            SEARCHABLE_LOADERS.includes(name) &&
            (name.toLowerCase().includes(search.toLowerCase()) || address.includes(search))
        );
    });

    if (matchedLoaders.length > 0) {
        return {
            label: 'Program Loaders',
            options: matchedLoaders.map(([id, name]) => ({
                label: name,
                pathname: '/address/' + id,
                value: [name, id],
            })),
        };
    }
}

function buildSysvarOptions(search: string) {
    const matchedSysvars = Object.entries(SYSVAR_IDS).filter(([address, name]) => {
        return name.toLowerCase().includes(search.toLowerCase()) || address.includes(search);
    });

    if (matchedSysvars.length > 0) {
        return {
            label: 'Sysvars',
            options: matchedSysvars.map(([id, name]) => ({
                label: name,
                pathname: '/address/' + id,
                value: [name, id],
            })),
        };
    }
}

function buildSpecialOptions(search: string) {
    const matchedSpecialIds = Object.entries(SPECIAL_IDS).filter(([address, name]) => {
        return name.toLowerCase().includes(search.toLowerCase()) || address.includes(search);
    });

    if (matchedSpecialIds.length > 0) {
        return {
            label: 'Accounts',
            options: matchedSpecialIds.map(([id, name]) => ({
                label: name,
                pathname: '/address/' + id,
                value: [name, id],
            })),
        };
    }
}

async function buildTokenOptions(search: string, cluster: Cluster): Promise<SearchOptions | undefined> {
    const matchedTokens = await searchTokens(search, cluster);

    if (matchedTokens.length > 0) {
        return {
            label: 'Tokens',
            options: matchedTokens,
        };
    }
}

async function buildDomainOptions(search: string) {
    const domainInfoResponse = await fetch(`/api/domain-info/${search}`);
    const domainInfo = (await domainInfoResponse.json()) as FetchedDomainInfo;

    if (domainInfo && domainInfo.owner && domainInfo.address) {
        return [
            {
                label: 'Domain Owner',
                options: [
                    {
                        label: domainInfo.owner,
                        pathname: '/address/' + domainInfo.owner,
                        value: [search],
                    },
                ],
            },
            {
                label: 'Name Service Account',
                options: [
                    {
                        label: search,
                        pathname: '/address/' + domainInfo.address,
                        value: [search],
                    },
                ],
            },
        ];
    }
}

function buildFeatureGateOptions(search: string) {
    let features: FeatureInfoType[] = [];
    if (search) {
        features = (FEATURES as FeatureInfoType[]).filter(feature =>
            feature.title.toUpperCase().includes(search.toUpperCase())
        );
    }

    if (features.length > 0) {
        return {
            label: 'Feature Gates',
            options: features.map(feature => ({
                label: feature.title,
                pathname: '/address/' + feature.key,
                value: [feature.key || ''],
            })),
        };
    }
}

// builds local search options
function buildOptions(rawSearch: string, cluster: Cluster, currentEpoch?: bigint) {
    const search = rawSearch.trim();
    if (search.length === 0) return [];

    const options = [];

    const programOptions = buildProgramOptions(search, cluster);
    if (programOptions) {
        options.push(programOptions);
    }

    const loaderOptions = buildLoaderOptions(search);
    if (loaderOptions) {
        options.push(loaderOptions);
    }

    const sysvarOptions = buildSysvarOptions(search);
    if (sysvarOptions) {
        options.push(sysvarOptions);
    }

    const specialOptions = buildSpecialOptions(search);
    if (specialOptions) {
        options.push(specialOptions);
    }

    const featureOptions = buildFeatureGateOptions(search);
    if (featureOptions) {
        options.push(featureOptions);
    }

    if (!isNaN(Number(search))) {
        options.push({
            label: 'Block',
            options: [
                {
                    label: `Slot #${search}`,
                    pathname: `/block/${search}`,
                    value: [search],
                },
            ],
        });

        // Parse as BigInt but not if it starts eg 0x or 0b
        if (currentEpoch !== undefined && !/^0\w/.test(search) && BigInt(search) <= currentEpoch + 1n) {
            options.push({
                label: 'Epoch',
                options: [
                    {
                        label: `Epoch #${search}`,
                        pathname: `/epoch/${search}`,
                        value: [search],
                    },
                ],
            });
        }
    }

    // Prefer nice suggestions over raw suggestions
    if (options.length > 0) return options;

    try {
        const decoded = bs58.decode(search);
        if (decoded.length === 32) {
            options.push({
                label: 'Account',
                options: [
                    {
                        label: search,
                        pathname: '/address/' + search,
                        value: [search],
                    },
                ],
            });
        } else if (decoded.length === 64) {
            options.push({
                label: 'Transaction',
                options: [
                    {
                        label: search,
                        pathname: '/tx/' + search,
                        value: [search],
                    },
                ],
            });
        }
    } catch (err) {
        // If bs58 decoding fails, check if it's a valid base64 string
        if (isValidBase64(search)) {
            const decodedTx = decodeTransactionFromBase64(search);
            if (decodedTx) {
                const pathname = '/tx/inspector';
                const searchParams = new URLSearchParams();

                searchParams.set('message', encodeURIComponent(decodedTx.message));

                if (decodedTx.signatures) {
                    searchParams.set('signatures', encodeURIComponent(JSON.stringify(decodedTx.signatures)));
                }

                options.push({
                    label: 'Transaction Inspector',
                    options: [
                        {
                            label: 'Inspect Decoded Transaction',
                            pathname: `${pathname}?${searchParams.toString()}`,
                            value: [search],
                        },
                    ],
                });
            }
        }
    }

    return options;
}

function decodeTransactionFromBase64(base64String: string): {
    message: string;
    signatures?: string[];
} | null {
    try {
        const buffer = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));

        if (buffer.length < MIN_MESSAGE_LENGTH) {
            return null;
        }

        // Try to parse as full transaction first
        let offset = 0;
        const numSignatures = buffer[offset++];

        // Check if message version matches signatures
        const requiredSignaturesByteOffset = 1 + numSignatures * 64;
        const versionOffset =
            VersionedMessage.deserializeMessageVersion(buffer.slice(requiredSignaturesByteOffset)) !== 'legacy' ? 1 : 0;

        const numRequiredSignaturesFromMessage = buffer[requiredSignaturesByteOffset + versionOffset];

        const signatures: string[] = [];

        // If signatures match message requirements, parse as full transaction
        if (numRequiredSignaturesFromMessage === numSignatures) {
            for (let i = 0; i < numSignatures; i++) {
                const sigBytes = buffer.subarray(offset, offset + 64);
                if (sigBytes.length !== 64) return null;
                signatures.push(bs58.encode(sigBytes));
                offset += 64;
            }

            // Encode remaining buffer as base64 message
            const messageBase64 = btoa(String.fromCharCode.apply(null, Array.from(buffer.slice(offset))));
            return {
                message: messageBase64,
                signatures,
            };
        }

        // If no valid signatures found, treat entire buffer as message
        return {
            message: base64String,
        };
    } catch (err) {
        return null;
    }
}

function isValidBase64(str: string): boolean {
    try {
        Buffer.from(str, 'base64');
        return true;
    } catch (err) {
        return false;
    }
}

function KeyIndicator() {
    return <div className="key-indicator">/</div>;
}

function ClearIndicator({
    onClick,
    onTouchStart,
}: {
    onClick: MouseEventHandler<HTMLDivElement>;
    onTouchStart: TouchEventHandler<HTMLDivElement>;
}) {
    return (
        <div className="clear-indicator" onClick={onClick} onTouchStart={onTouchStart}>
            <X size={16} />
        </div>
    );
}

function buildAppendableSearchOptions(
    searchOptions: PromiseSettledResult<SearchOptions | SearchOptions[] | undefined> | undefined,
    name: string
): SearchOptions[] {
    if (!searchOptions) return [];
    if (searchOptions.status === 'rejected') {
        console.error(`Failed to build ${name} options for search: ${searchOptions.reason}`);
        return [];
    }
    return searchOptions.value
        ? Array.isArray(searchOptions.value)
            ? searchOptions.value
            : [searchOptions.value]
        : [];
}

export default SearchBar;
