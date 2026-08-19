import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './types';
import { navigationRef } from './ref';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import ForgotPassword from '../screens/ForgotPassword';
import DriverTabs from './DriverTabs';
import AdminTabs from './AdminTabs';
import DispatchDetail from '../screens/shared/DispatchDetail';
import DispatchReportView from '../screens/shared/DispatchReportView';
import RouteRecon from '../screens/admin/RouteRecon';
import VehiclesScreen from '../screens/admin/VehiclesScreen';
import AgentsScreen from '../screens/admin/AgentsScreen';
import DispatchesScreen from '../screens/admin/DispatchesScreen';
import CreateDispatchScreen from '../screens/admin/CreateDispatchScreen';
import CustomersScreen from '../screens/admin/CustomersScreen';
import CustomerDetail from '../screens/admin/CustomerDetail';
import InvoicesScreen from '../screens/admin/InvoicesScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import ReportView from '../screens/admin/ReportView';
import SchoolDispatchScreen from '../screens/admin/SchoolDispatchScreen';
import ShortagesScreen from '../screens/admin/ShortagesScreen';
import CommissionsScreen from '../screens/shared/CommissionsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background },
};

export default function RootNavigator() {
  const { state, activeView } = useAuth();

  if (state === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state === 'signedOut' ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          </>
        ) : (
          <>
            {activeView === 'admin' ? (
              <Stack.Screen name="AdminTabs" component={AdminTabs} />
            ) : (
              <Stack.Screen name="DriverTabs" component={DriverTabs} />
            )}
            <Stack.Screen name="DispatchDetail" component={DispatchDetail} />
            <Stack.Screen name="DispatchReport" component={DispatchReportView} />
            <Stack.Screen name="RouteRecon" component={RouteRecon} />
            <Stack.Screen name="Vehicles" component={VehiclesScreen} />
            <Stack.Screen name="Agents" component={AgentsScreen} />
            <Stack.Screen name="Dispatches" component={DispatchesScreen} />
            <Stack.Screen name="CreateDispatch" component={CreateDispatchScreen} />
            <Stack.Screen name="SchoolDispatch" component={SchoolDispatchScreen} />
            <Stack.Screen name="Shortages" component={ShortagesScreen} />
            <Stack.Screen name="Commissions" component={CommissionsScreen} />
            <Stack.Screen name="Customers" component={CustomersScreen} />
            <Stack.Screen name="CustomerDetail" component={CustomerDetail} />
            <Stack.Screen name="Invoices" component={InvoicesScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="ReportView" component={ReportView} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
