// import { Component, inject } from '@angular/core';
// import { FormsModule } from '@angular/forms';
// import { Router } from '@angular/router';
// import { Authservice } from '../services/auth';

// @Component({
//   selector: 'app-login',
//   standalone: true,
//   imports: [FormsModule],
//   templateUrl: './login.html',
//   styleUrl: './login.css'
// })
// export class Login {

//   username: string = '';
//   password: string = '';
//   showPassword: boolean = false;

//   private auth = inject(Authservice);
//   private router = inject(Router);

//   login() {

//     this.auth.login(this.username, this.password).subscribe({
//       next: (res: any) => {

//         console.log("LOGIN RESPONSE:", res);

//         if (res.statusCode === 200 && res.data?.login === 'success') {

//           // ✅ Store token
//           this.auth.storeToken(res.data.accessToken);

//           // ✅ Store user info
//           localStorage.setItem('username', res.data.username);
//           localStorage.setItem('department_name', res.data.department_name);
//           localStorage.setItem('district_name', res.data.district_name);
//           localStorage.setItem('zone_name', res.data.zone_name);
//           localStorage.setItem('auth_token', res.data.accessToken);






//           // localStorage.setItem('uid', String(res.data.uid || 0));
//           localStorage.setItem('uid', String(res.data.user_id || 0));
//           console.log("✅ STORED UID:", res.data.uid);







//           // 🔥 MAIN FIX: STORE IDS (VERY IMPORTANT)
//           localStorage.setItem('department_id', String(res.data.department_id || 0));
//           localStorage.setItem('district_id', String(res.data.district_id || 0));
//           localStorage.setItem('zone_id', String(res.data.zone_id || 0));

//           console.log("✅ STORED IDs:",
//             res.data.department_id,
//             res.data.district_id,
//             res.data.zone_id
//           );

//           // ✅ Role check
//           if (res.data.is_admin === true) {

//             localStorage.setItem('role', 'admin');
//             this.router.navigate(['/layout/admin-dashboard']);

//           } else {

//             localStorage.setItem('role', 'user');
//             this.router.navigate(['/layout/totalforms']);

//           }

//         } else {
//           alert("Invalid username or password");
//         }
//       },

//       error: (err) => {
//         console.error("LOGIN ERROR:", err);
//         alert("Invalid username or password");
//       }
//     });
//   }
// }


import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  username: string = '';
  password: string = '';
  showToast = false;
  toastMessage = '';

  showPassword: boolean = false;

  // ✅ ADDED
  loading: boolean = false;
  errorMessage: string = '';

  private auth = inject(AuthService);
  private router = inject(Router);


  login() {

    console.log("Username:", this.username);
    console.log("Password:", this.password);

    // TEST
    // alert('Login button clicked');

    // START LOADING
    this.loading = true;
    this.errorMessage = '';

    // 10 SECOND TIMEOUT
    const timeout = setTimeout(() => {

      console.log('TIMEOUT HIT');

      this.loading = false;
      this.errorMessage = 'Something went wrong. Please try again.';

      alert('Something went wrong. Please try again.');

    }, 10000);

    this.auth.login(this.username, this.password).subscribe({

      next: (res: any) => {

        clearTimeout(timeout);

        this.loading = false;

        console.log("LOGIN RESPONSE:", res);

        if (res.statusCode === 200 && res.data?.login === 'success') {

          // Store token
          this.auth.storeToken(res.data.accessToken);

          // Store user info
          localStorage.setItem('username', res.data.username);
          localStorage.setItem('department_name', res.data.department_name);
          localStorage.setItem('district_name', res.data.district_name);
          // localStorage.setItem('zone_name', res.data.zone_name);
          localStorage.setItem(
            'zone_name',
            res.data.zone_name?.[0] || ''
          );
          localStorage.setItem('auth_token', res.data.accessToken);

          // Store UID
          localStorage.setItem('uid', String(res.data.user_id || 0));

          // Store IDs
          localStorage.setItem('department_id', String(res.data.department_id || 0));
          localStorage.setItem('district_id', String(res.data.district_id || 0));
          // localStorage.setItem('zone_id', String(res.data.zone_id || 0));

          localStorage.setItem(
            'zone_id',
            String(res.data.zone_id?.[0] || 0)
          );
          // Show success toast
          this.showSuccessToast('Login Successful');

          // Delay navigation
          setTimeout(() => {

            if (res.data.is_admin === true) {

              localStorage.setItem('role', 'admin');
              this.router.navigate(['/layout/admin-dashboard']);

            } else {

              localStorage.setItem('role', 'user');
              this.router.navigate(['/layout/totalforms']);

            }

          }, 1500);

        } else {

          this.errorMessage = 'Invalid username or password';

          alert('Invalid username or password');
        }
      },

      error: (err) => {

        clearTimeout(timeout);

        this.loading = false;

        console.error("LOGIN ERROR:", err);

        this.errorMessage = 'Invalid username or password';

        alert('Invalid username or password');
      }
    });
  }

  showSuccessToast(message: string) {
    this.toastMessage = message;
    this.showToast = true;


    setTimeout(() => {

      this.showToast = false;
    }, 3000);
  }
}


