import type { Event } from '../lib/types';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { EventQrScreen } from '../screens/EventQrScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ScanEventScreen } from '../screens/ScanEventScreen';
import { colors } from '../theme';

export type EventsStackParams = {
  EventsHome: undefined;
  ScanEvent: undefined;
  EventQr: { event: Event };
};

const Stack = createNativeStackNavigator<EventsStackParams>();

export function EventsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="EventsHome" component={EventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="ScanEvent" component={ScanEventScreen} options={{ title: 'Scan event QR' }} />
      <Stack.Screen name="EventQr" component={EventQrScreen} options={{ title: 'Event QR code' }} />
    </Stack.Navigator>
  );
}
