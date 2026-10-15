import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { DifficultySummary } from '../components/DifficultySummary';
import { SpikeNotice } from '../components/SpikeNotice';
import { courseSpikes, upcomingSpikes } from '../lib/difficulty';
import { wallSemester } from '../testing/fixtures';

const summaries = courseSpikes(wallSemester);
const notices = upcomingSpikes(summaries, wallSemester.currentWeek);

describe('SpikeNotice', () => {
  it('states the course, hours, capacity, week and estimate basis in words', () => {
    render(<SpikeNotice notices={notices} capacity={wallSemester.weeklyCapacity} />);
    expect(screen.getByText('CS 262 needs 10 of your 10 hours in week 5')).toBeTruthy();
    expect(screen.getByText(/Based on estimated hours/)).toBeTruthy();
    expect(screen.getByLabelText(/CS 262 difficulty spike in week 5/)).toBeTruthy();
  });

  it('renders nothing when there are no upcoming spikes', () => {
    render(<SpikeNotice notices={[]} capacity={wallSemester.weeklyCapacity} />);
    expect(screen.queryByTestId('spike-notices')).toBeNull();
  });
});

describe('DifficultySummary', () => {
  it('summarizes each course peak and says it uses estimated hours', () => {
    render(<DifficultySummary summaries={summaries} />);
    expect(screen.getByText('CS 262 peaks in week 7 at 14 hours')).toBeTruthy();
    expect(screen.getByText('MATH 251 peaks in week 6 at 8 hours')).toBeTruthy();
    expect(screen.getByText(/Based on estimated hours/)).toBeTruthy();
  });

  it('uses text and accessibility labels, not colour alone', () => {
    render(<DifficultySummary summaries={summaries} />);
    expect(screen.getByLabelText(/CS 262 has difficulty spikes/)).toBeTruthy();
    expect(screen.getByText(/Weeks 5, 6 and 7/)).toBeTruthy();
  });
});
