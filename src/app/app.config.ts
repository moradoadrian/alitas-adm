// app.config.ts
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { initializeFirestore } from 'firebase/firestore';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const appConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() =>
      initializeFirestore(getApp(), {
        experimentalForceLongPolling: true, // ✅ solo esta
        
      })
      
    ),
    provideAuth(() => getAuth()),
    provideRouter(routes),
    
  ]
  
};
