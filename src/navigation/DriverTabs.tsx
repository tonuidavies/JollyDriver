import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomTabBar from './BottomTabBar';
import { DriverTabsParamList } from './types';

import DriverDashboard from '../screens/driver/DriverDashboard';
import RouteListScreen from '../screens/driver/RouteListScreen';
import DriverCollections from '../screens/driver/DriverCollections';
import DriverProfile from '../screens/driver/DriverProfile';

const Tab = createBottomTabNavigator<DriverTabsParamList>();

export default function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={DriverDashboard} />
      <Tab.Screen name="Route" component={RouteListScreen} />
      <Tab.Screen name="Collections" component={DriverCollections} />
      <Tab.Screen name="Profile" component={DriverProfile} />
    </Tab.Navigator>
  );
}
