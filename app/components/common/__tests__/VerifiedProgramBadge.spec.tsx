import { PublicKey } from '@solana/web3.js';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import { Cluster } from '@/app/utils/cluster';

import { VerifiedProgramBadge } from '../VerifiedProgramBadge';

vi.mock('@/app/providers/cluster', () => ({
    useCluster: vi.fn(),
}));
vi.mock('@/app/utils/url', () => ({
    useClusterPath: vi.fn(() => '/address/mock/verified-build'),
}));

// Mock the useIsProgramVerified hook
vi.mock('@/app/utils/verified-builds', () => ({
    useIsProgramVerified: vi.fn(),
}));

import { useCluster } from '@/app/providers/cluster';
import { useIsProgramVerified } from '@/app/utils/verified-builds';

const mockProgramData = {
    authority: new PublicKey('11111111111111111111111111111111'),
    data: ['deadbeef', 'base64'] as [string, 'base64'],
    slot: 123,
};
const mockPubkey = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');

describe('VerifiedProgramBadge (mocked useIsProgramVerified)', () => {
    afterEach(() => vi.clearAllMocks());

    it('shows verified badge when isVerified is true', () => {
        (useCluster as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ cluster: Cluster.MainnetBeta });
        (useIsProgramVerified as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            data: true,
            error: false,
            isLoading: false,
        });
        render(<VerifiedProgramBadge programData={mockProgramData} pubkey={mockPubkey} />);
        expect(screen.getByText(/Program Source Verified/i)).toBeInTheDocument();
    });

    it('shows not verified badge when isVerified is false', () => {
        (useCluster as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ cluster: Cluster.MainnetBeta });
        (useIsProgramVerified as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            data: false,
            error: false,
            isLoading: false,
        });
        render(<VerifiedProgramBadge programData={mockProgramData} pubkey={mockPubkey} />);
        expect(screen.getByText(/Not verified/i)).toBeInTheDocument();
    });

    it('shows error badge when error is true', () => {
        (useCluster as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ cluster: Cluster.MainnetBeta });
        (useIsProgramVerified as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            data: false,
            error: true,
            isLoading: false,
        });
        render(<VerifiedProgramBadge programData={mockProgramData} pubkey={mockPubkey} />);
        expect(screen.getByText(/Error fetching verified build information/i)).toBeInTheDocument();
    });

    it('shows loading badge when isLoading is true', () => {
        (useCluster as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ cluster: Cluster.MainnetBeta });
        (useIsProgramVerified as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            data: false,
            error: false,
            isLoading: true,
        });
        render(<VerifiedProgramBadge programData={mockProgramData} pubkey={mockPubkey} />);
        expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
});
