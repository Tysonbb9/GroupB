import { render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { CourseCards } from '../components/CourseCards';
import { SpikeNotice } from '../components/SpikeNotice';
import { courseSpikes, upcomingSpikes } from '../lib/difficulty';
import { wallSemester } from '../testing/fixtures';

const summaries = courseSpikes(wallSemester);
const notices = upcomingSpikes(summaries, wallSemester.currentWeek);

describe('SpikeNotice', () => {
  it('shows the week, the course and its hours out of capacity', () => {
    render(<SpikeNotice notices={notices} capacity={wallSemester.weeklyCapacity} />);
    const notice = within(screen.getByTestId('spike-notice-c1-5'));
    expect(notice.getByText('5')).toBeTruthy();
    expect(notice.getByText('CS 262')).toBeTruthy();
    expect(notice.getByText('10 of your 10 allocated hours')).toBeTruthy();
  });

  it('says it in words for screen readers, not colour alone', () => {
    render(<SpikeNotice notices={notices} capacity={wallSemester.weeklyCapacity} />);
    expect(
      screen.getByLabelText('CS 262 busiest week, week 5, 10 of your 10 allocated hours')
    ).toBeTruthy();
  });

  it('renders nothing when there are no upcoming spikes', () => {
    render(<SpikeNotice notices={[]} capacity={wallSemester.weeklyCapacity} />);
    expect(screen.queryByTestId('spike-notices')).toBeNull();
  });
});

describe('CourseCards', () => {
  it('gives each course its peak week and hours', () => {
    render(<CourseCards semester={wallSemester} summaries={summaries} />);
    expect(within(screen.getByTestId('course-c1')).getByText(/Busiest in weeks 5, 6 and 7/)).toBeTruthy();
    expect(within(screen.getByTestId('course-c2')).getByText(/Busiest in week 6/)).toBeTruthy();
  });

  it('lists the heavy weeks in words and labels, not colour alone', () => {
    render(<CourseCards semester={wallSemester} summaries={summaries} />);
    expect(screen.getByText(/weeks 5, 6 and 7/)).toBeTruthy();
    expect(screen.getByLabelText(/CS 262 is busiest in weeks 5, 6 and 7/)).toBeTruthy();
  });

  it('says so for a course with no heavy weeks', () => {
    render(
      <CourseCards
        semester={{ ...wallSemester, tasks: [] }}
        summaries={courseSpikes({ ...wallSemester, tasks: [] })}
      />
    );
    expect(within(screen.getByTestId('course-c1')).getByText('No standout weeks')).toBeTruthy();
  });
});
