import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import JobListRow from '@/components/JobListRow';

describe('JobListRow', () => {
  const mockProps = {
    jobId: 'job-123',
    company: 'Google',
    title: 'Software Engineer',
    location: 'Mountain View, CA',
    employmentType: 'Full-time',
    postedAt: '2026-03-15T14:30:00Z',
    scrapedAt: '2026-03-15T14:30:00Z',
    applyUrl: 'https://example.com/job',
  };

  it('renders job information correctly', () => {
    render(<JobListRow {...mockProps} />);

    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Mountain View, CA/)).toBeInTheDocument();
  });

  it('renders VIEW link with correct href', () => {
    render(<JobListRow {...mockProps} />);

    const link = screen.getByRole('link', { name: /View Software Engineer at Google/i });
    expect(link).toHaveAttribute('href', 'https://example.com/job');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders tech stack when provided', () => {
    render(<JobListRow {...mockProps} techStack={['React', 'TypeScript']} />);

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('renders match percentile when provided', () => {
    render(<JobListRow {...mockProps} matchPercentile={95} />);

    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('MATCH')).toBeInTheDocument();
  });

  it('shows CLOSED status when job is closed', () => {
    render(<JobListRow {...mockProps} jobStatus="CLOSED" />);
    expect(screen.getByText('CLOSED')).toBeInTheDocument();
  });

  it('shows APPLY button when onApply is provided and job is active', () => {
    const onApply = () => {};
    render(<JobListRow {...mockProps} jobStatus="ACTIVE" onApply={onApply} />);
    expect(screen.getByRole('button', { name: /APPLY/i })).toBeInTheDocument();
  });

  it('shows applied state when alreadyApplied is true', () => {
    const onApply = () => {};
    render(<JobListRow {...mockProps} alreadyApplied={true} onApply={onApply} />);
    expect(screen.getAllByText(/APPLIED/).length).toBeGreaterThan(0);
  });
});
