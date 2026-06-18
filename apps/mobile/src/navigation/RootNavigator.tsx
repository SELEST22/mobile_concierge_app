/**
 * Top-level navigation: shows the auth flow when signed out and the main tab
 * bar when signed in. The admin-only "Broadcast" tab appears only for admins.
 */
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AdminBroadcastScreen } from '../screens/AdminBroadcastScreen';
import { ArchivedScreen } from '../screens/ArchivedScreen';
import { ConciergeScreen } from '../screens/ConciergeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { colors } from '../theme';

export type AuthStackParams = {
  Login: undefined;
  Register: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const Tabs = createBottomTabNavigator();

const screenIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Alerts: 'notifications',
  Archive: 'archive',
  Concierge: 'sparkles',
  Broadcast: 'megaphone',
  Profile: 'person',
};

function MainTabs() {
  const { isAdmin } = useAuth();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={screenIcons[route.name] ?? 'ellipse'} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="Alerts" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Tabs.Screen name="Archive" component={ArchivedScreen} options={{ title: 'Archived' }} />
      <Tabs.Screen name="Concierge" component={ConciergeScreen} />
      {isAdmin && (
        <Tabs.Screen name="Broadcast" component={AdminBroadcastScreen} options={{ title: 'Broadcast' }} />
      )}
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
      </AuthStack.Navigator>
    );
  }

  return <MainTabs />;
}
