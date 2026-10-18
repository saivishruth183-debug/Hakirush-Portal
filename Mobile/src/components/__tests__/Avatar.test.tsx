import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar } from '@/components/Avatar';
import { avatarColorFor, getInitials } from '@/utils/identity';

describe('Avatar', () => {
  it('shows deterministic initials when there is no photo', async () => {
    await render(<Avatar name="Asha Rao" id="user-1" />);
    expect(screen.getByLabelText('Asha Rao initials')).toBeTruthy();
    expect(screen.getByText('AR')).toBeTruthy();
    expect(avatarColorFor('user-1')).toBe(avatarColorFor('user-1'));
    expect(getInitials('madonna')).toBe('M');
  });

  it('shows the photo, then falls back to initials when the image fails to load', async () => {
    await render(<Avatar name="Bala Krishnan" id="user-2" uri="https://img.example.com/b.jpg" />);
    expect(screen.getByLabelText('Photo of Bala Krishnan')).toBeTruthy();
    await fireEvent(screen.getByTestId('expo-image'), 'error');
    expect(screen.getByLabelText('Bala Krishnan initials')).toBeTruthy();
    expect(screen.getByText('BK')).toBeTruthy();
  });
});
