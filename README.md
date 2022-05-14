# switch-profile

Switch between AWS profiles without having to manually edit the `.aws/credentials` or the environment variables. 

```
npx switch-profile
```

This terminal utility helps switching between AWS CLI profiles. It sets the `default` profile by editing the `.aws/credentials` file. It requires `AWS CLI v2` to be installed. 

This utility also supports creating new AWS profiles, including SSO profiles as well as deleting them. 

> WARNING: Make sure that the following environment variables have been removed from your path, otherwise, they will conflict with the default AWS CLI profile:
>	- `AWS_ACCESS_KEY_ID`
>	- `AWS_SECRET_ACCESS_KEY`
>	- `AWS_SESSION_TOKEN`

# Table of contents

> * [Extra features](#extra-features)
> * [FAQ](#faq)
>	- [Why using this utility?](#why-using-this-utility)
>	- [How to create a new SSO profile?](#how-to-create-a-new-sso-profile)
> * [Troubleshooting](#troubleshooting)
>	- [`invalid_grant: Invalid grant provided`](#invalid_grant-invalid-grant-provided)
>	- [`Error: Fail to get credentials for profile ... Error loading SSO Token...`](#error-fail-to-get-credentials-for-profile--error-loading-sso-token)
> * [License](#license)

# Extra features

The `More options` supports the following:
- `Create profile`: Helps create both a standard or AWS SSO profile.
- `Delete profiles`: Helps cleaning one or many profiles.
- `Refresh default profile`: Helps refreshing the current default profile if it has expired (e.g., SSO profile). This option only appears when the default profile has expired.

# FAQ
## Why using this utility?

`switch-profile` was originally created to refresh short-lived AWS SSO profiles in the terminal and set them as default. Indeed, as of 2021, the only two ways to set up a short-lived SSO profile as default in the terminal are:
- Manually paste the short-lived credentials in the terminal:
	- Browse to the AWS SSO login page and login. 
	- Select an account.
	- Reveal the short-lived credentials (i.e., AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN).
	- Copy paste them in the terminal or manually edit the `.aws/credentials` file.
- Create an SSO profile in the terminal and update its credentials via the CLI:
	- Creating an SSO profile: `aws configure sso`
	- Renew a SSO credentials for a specific profile: `aws sso login --profile YOUR_PROFILE`

The issue with the first method is that you have to repeat it every hour, which can make long days feel even longer. The issue with the second method is that it requires your code or third party app (e.g, Terraform) to support the `--profile` option. There are scenarios where using this `--profile` option is either not possible or impractical (often impractical as this may mean all engineers should agree to use the same convention for the profile's name).

`switch-profile` aims to solve those issues by making setting any profile as `default` trivial. 

## How to create a new SSO profile?

1. `npx switch-profile`
2. Select `More options`, then `Create profile`.
3. Answer all the questions.

# Troubleshooting
## `invalid_grant: Invalid grant provided`

If this error occurs during a [profile creation step](#how-to-create-a-new-sso-profile), this is most likely due to an incorrect SSO region. AWS SSO is region specific. This error occurs if an incorrect region is specified during the [profile creation step](#how-to-create-a-new-sso-profile).

## `Error: Fail to get credentials for profile ... Error loading SSO Token...`

This is probably due to a recent deletion of the `~/.aws/sso/cache` folder. This folder keeps track of the SSO profiles created on the local machine. Unfortunately in this case, there is no other option but to recreate all the SSO profiles manually:
1. Execute `npx switch-profile`
2. Select `More options`, then `Delete profiles`.

# License

BSD 3-Clause License