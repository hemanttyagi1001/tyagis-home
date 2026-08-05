import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

import HomeScreen from '../screens/HomeScreen';
import MilkCalendarScreen from '../screens/MilkCalendarScreen';
import EmployeeListScreen from '../screens/EmployeeListScreen';
import EmployeeAttendanceScreen from '../screens/EmployeeAttendanceScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function EmployeeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="EmployeeList"
        component={EmployeeListScreen}
        options={{ title: 'Employees' }}
      />
      <Stack.Screen
        name="EmployeeAttendance"
        component={EmployeeAttendanceScreen}
        options={({ route }) => ({ title: `${route.params.employee.name}'s Attendance` })}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'HomeTab') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'MilkTab') {
              iconName = focused ? 'water' : 'water-outline';
            } else if (route.name === 'EmployeeTab') {
              iconName = focused ? 'people' : 'people-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textLight,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            height: 60,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{ title: "Tyagi's Home", headerShown: false, tabBarLabel: 'Home' }}
        />
        <Tab.Screen
          name="MilkTab"
          component={MilkCalendarScreen}
          options={{ title: 'Milk Tracker', tabBarLabel: 'Milk' }}
        />
        <Tab.Screen
          name="EmployeeTab"
          component={EmployeeStack}
          options={{ headerShown: false, tabBarLabel: 'Employees' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
