import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { useClerk, useAuth } from '@clerk/expo';
import { useCreateMyProfile, useGetMyProfile } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/context/locale';
export default function Profile() {
 const c=useColors(); const {t}=useLocale(); const {isSignedIn}=useAuth(); const {signOut}=useClerk(); const current=useGetMyProfile({query:{enabled:!!isSignedIn,queryKey:['/api/me']}}); const [name,setName]=useState('');
 const create=useCreateMyProfile({mutation:{onSuccess:()=>current.refetch(),onError:(e:any)=>Alert.alert(t('createFailed'),e?.message??t('tryAgain'))}});
 if(!isSignedIn)return <View style={[styles.center,{backgroundColor:c.background}]}><Text style={[styles.title,{color:c.foreground}]}>{t('profile')}</Text><Text style={{color:c.mutedForeground,marginTop:10}}>{t('signedOutProfile')}</Text></View>;
 if(current.isLoading)return <View style={[styles.center,{backgroundColor:c.background}]}><Text style={{color:c.mutedForeground}}>{t('loadingProfile')}</Text></View>;
  // A 404 is the expected state for a signed-in member who has not created
  // or claimed a photographer profile yet. Other failures still offer retry.
  if(current.isError && current.error.status !== 404)return <View style={[styles.center,{backgroundColor:c.background}]}><Text style={{color:c.mutedForeground}}>{t('profileUnavailable')}</Text><Pressable onPress={()=>current.refetch()}><Text style={{color:c.primary,marginTop:14}}>{t('retry')}</Text></Pressable></View>;
 return <View style={[styles.root,{backgroundColor:c.background}]}><Stack.Screen options={{title:t('profile')}}/>{current.data?<><Text style={[styles.title,{color:c.foreground}]}>{current.data.name}</Text><Text style={{color:c.mutedForeground,marginTop:8}}>{t('profileLinked')}</Text><Pressable onPress={()=>signOut()}><Text style={{color:c.primary,marginTop:25}}>{t('signOut')}</Text></Pressable></>:<><Text style={[styles.title,{color:c.foreground}]}>{t('createProfile')}</Text><TextInput value={name} onChangeText={setName} placeholder={t('name')} placeholderTextColor={c.mutedForeground} style={[styles.input,{color:c.foreground,borderColor:c.border}]}/><Pressable disabled={!name.trim()||create.isPending} onPress={()=>create.mutate({data:{name:name.trim()}})} style={[styles.button,{backgroundColor:c.primary}]}><Text style={{color:c.primaryForeground}}>{t('createProfile')}</Text></Pressable></>}</View>;
}
const styles=StyleSheet.create({root:{flex:1,padding:22,justifyContent:'center'},center:{flex:1,justifyContent:'center',alignItems:'center',padding:22},title:{fontSize:30,fontWeight:'700'},input:{borderWidth:1,padding:14,borderRadius:7,marginTop:22},button:{padding:15,borderRadius:7,alignItems:'center',marginTop:15}});