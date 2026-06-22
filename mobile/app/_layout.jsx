import{Stack}from'expo-router';import{AuthProvider}from'../src/AuthContext';export default function Layout(){return <AuthProvider><Stack screenOptions={{headerShown:false}}/></AuthProvider>}
