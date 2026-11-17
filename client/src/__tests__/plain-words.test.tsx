import Ionicons from '@expo/vector-icons/Ionicons';
import { render, screen } from '@testing-library/react-native';
import * as Font from 'expo-font';
import React from 'react';
import { WallCard } from '../components/WallCard';
import type { Task } from '../lib/types';

beforeAll(async () => { await Font.loadAsync(Ionicons.font); });
const task: Task = { id: 'midterm', courseId: 'c1', title: 'Midterm', category: 'exam', dueWeek: 6, estimatedHours: 12, done: false };
const props = { wall: { week: 6, hours: 27 }, period: { startWeek: 5, endWeek: 7, peakHours: 27 }, capacity: 15, currentWeek: 3, onPlan: jest.fn(), recommendation: { task, startWeek: 5 } };
it('states the heavy week and allocated hours plainly', () => {
  render(<WallCard {...props} />);
  expect(screen.getByText('Next heavy week · week 6')).toBeTruthy();
  expect(screen.getByText("Week 6 needs 27 hours. You've allocated 15.")).toBeTruthy();
  expect(screen.getByTestId('crunch-period')).toHaveTextContent('Weeks 5 to 7 need more than your allocated time');
});
it('names studying and the future starting week', () => {
  render(<WallCard {...props} />);
  expect(screen.getByText('Start studying for Midterm in week 5.')).toBeTruthy();
});
it('names reading and now when the starting week has arrived', () => {
  render(<WallCard {...props} currentWeek={5} recommendation={{ task: { ...task, title: 'Chapter 4', category: 'reading' }, startWeek: 5 }} />);
  expect(screen.getByText('Start reading Chapter 4 now.')).toBeTruthy();
});
it('explains a clear forecast without the old terms', () => {
  render(<WallCard {...props} wall={null} recommendation={null} period={null} />);
  expect(screen.getByText('No heavy weeks ahead')).toBeTruthy();
  expect(screen.getByText('Every week left fits in your 15 hours')).toBeTruthy();
});
