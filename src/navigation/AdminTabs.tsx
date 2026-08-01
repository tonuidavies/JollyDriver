import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomTabBar from './BottomTabBar';
import { AdminTabsParamList } from './types';

import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminDriverLedger from '../screens/admin/AdminDriverLedger';
import AdminMonthlyLedger from '../screens/admin/AdminMonthlyLedger';
import AdminUserManagement from '../screens/admin/AdminUserManagement';

const Tab = createBottomTabNavigator<AdminTabsParamList>();

export default function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={AdminDashboard} />
      <Tab.Screen name="Route" component={AdminDriverLedger} />
      <Tab.Screen name="Collections" component={AdminMonthlyLedger} />
      <Tab.Screen name="Profile" component={AdminUserManagement} />
    </Tab.Navigator>
  );
}
