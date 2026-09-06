import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import '@ganttkit/angular/styles.css'
import { AppComponent } from './app.component'

bootstrapApplication(AppComponent, {
  providers: [provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection()],
})
