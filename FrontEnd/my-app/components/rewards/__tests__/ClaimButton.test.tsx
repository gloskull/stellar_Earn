import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ClaimButton } from '../ClaimButton';

describe('ClaimButton', () => {
  it('renders correctly in idle state', () => {
    render(<ClaimButton onClick={vi.fn()} status="idle" />);

    const button = screen.getByRole('button', { name: 'Claim all rewards' });
    expect(button).not.toBeDisabled();
    expect(screen.getByText('Claim All Rewards')).toBeInTheDocument();
  });

  it('renders disabled when disabled prop is true', () => {
    render(<ClaimButton onClick={vi.fn()} status="idle" disabled={true} />);

    const button = screen.getByRole('button', {
      name: 'Claim rewards unavailable',
    });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('bg-zinc-400');
  });

  it('renders loading spinner and disabled state when status is pending', () => {
    render(<ClaimButton onClick={vi.fn()} status="pending" />);

    const button = screen.getByRole('button', {
      name: 'Processing transaction, please wait',
    });
    expect(button).toBeDisabled();
    expect(screen.getByText('Processing Transaction...')).toBeInTheDocument();
  });

  it('triggers onClick once on a single click', async () => {
    const handleClick = vi.fn().mockResolvedValue(undefined);
    render(<ClaimButton onClick={handleClick} status="idle" />);

    const button = screen.getByRole('button', { name: 'Claim all rewards' });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('guards against duplicate rapid clicks during in-flight request', async () => {
    let resolveClaim!: () => void;
    const claimPromise = new Promise<void>((resolve) => {
      resolveClaim = resolve;
    });
    const handleClick = vi.fn().mockReturnValue(claimPromise);

    render(<ClaimButton onClick={handleClick} status="idle" />);
    const button = screen.getByRole('button', { name: 'Claim all rewards' });

    // Click 5 times rapidly
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    // onClick should only have been called ONCE due to in-flight lock
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Button should be in pending/disabled state while in-flight
    expect(button).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Processing transaction, please wait',
      })
    ).toBeInTheDocument();

    // Resolve the claim request
    await act(async () => {
      resolveClaim();
    });

    // After resolution, in-flight state resets
    expect(button).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Claim all rewards' })
    ).toBeInTheDocument();
  });

  it('resets in-flight lock even when the claim request rejects/fails', async () => {
    let rejectClaim!: (err: Error) => void;
    const claimPromise = new Promise<void>((_, reject) => {
      rejectClaim = reject;
    });
    const handleClick = vi.fn().mockReturnValue(claimPromise);

    render(<ClaimButton onClick={handleClick} status="idle" />);
    const button = screen.getByRole('button', { name: 'Claim all rewards' });

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    // Reject the claim request
    await act(async () => {
      rejectClaim(new Error('Network error'));
    });

    // Button state should reset back to active
    expect(button).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Claim all rewards' })
    ).toBeInTheDocument();
  });
});
