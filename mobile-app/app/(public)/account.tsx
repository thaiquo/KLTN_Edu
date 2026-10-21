import React from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppShell } from '../../src/components/AppShell';
import { Button } from '../../src/components/Ui';
import { base } from '../../src/theme/tokens';

export default function GuestAccount() { return <AppShell active="account" title="Tài khoản"><ScrollView contentContainerStyle={styles.content}>
  <Text style={styles.title}>Tài khoản EduConnect</Text><Text style={styles.detail}>Đăng nhập để quản lý hành trình học tập hoặc giảng dạy.</Text>
  <View style={styles.actions}><Button label="Đăng nhập" onPress={() => router.push('/(auth)/sign-in')} /><Button label="Tạo tài khoản" onPress={() => router.push('/(auth)/register')} secondary /></View>
</ScrollView></AppShell>; }

const styles = StyleSheet.create({ content: { maxWidth: 560, alignSelf: 'stretch', padding: 20, paddingTop: 38 }, title: { color: base.ink, fontSize: 26, fontWeight: '800' }, detail: { color: base.muted, fontSize: 14, lineHeight: 22, marginTop: 8 }, actions: { marginTop: 25 } });
