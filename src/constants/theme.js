export const COLORS = {
  primary: '#4A6741',
  primaryDark: '#3A5331',
  primaryLight: '#6B8F61',
  secondary: '#D4A843',
  background: '#F5F5F0',
  surface: '#FFFFFF',
  text: '#2C2C2C',
  textSecondary: '#666666',
  textLight: '#999999',
  border: '#E0E0E0',
  error: '#D32F2F',
  success: '#388E3C',
  warning: '#F57C00',
  white: '#FFFFFF',
  fullDay: '#4CAF50',
  halfDay: '#FF9800',
  leave: '#F44336',
  absent: '#9E9E9E',
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.text },
  medium: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  bold: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  header: { fontSize: 24, fontWeight: '700', color: COLORS.text },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
};
