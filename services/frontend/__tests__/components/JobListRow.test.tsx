import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import JobListRow from '@/components/JobListRow';

describe('JobListRow', () => {
  const mockProps = {
    company: 'Google',
    title: 'Software Engineer',
    location: 'Mountain View, CA',
    employmentType: 'Full-time',
    scrapedAt: '2026-03-15T14:30:00Z',
    applyUrl: 'https://example.com/job',
  };

  it('renders job information correctly', () => {
    render(<JobListRow {...mockProps} />);

    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Mountain View, CA/)).toBeInTheDocument();
  });

  it('renders apply link with correct href', () => {
    render(<JobListRow {...mockProps} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/job');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('has proper accessibility attributes', () => {
    render(<JobListRow {...mockProps} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('tabIndex', '0');
    expect(link).toHaveAttribute('aria-label');
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
});
