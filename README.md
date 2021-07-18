# switch-profile

```
npx switch-profile
```

This terminal utility helps switching between AWS CLI profiles. It sets the `default` profile, by editing the `.aws/credentials` file. It requires `AWS CLI v2` to be installed. 

This utility also supports creating new AWS profiles, including SSO profiles as well as deleting them. 

> WARNING: Make sure that the following environment variables have been removed from your path, otherwise, they will conflict with the default AWS CLI profile:
>	- `AWS_ACCESS_KEY_ID`
>	- `AWS_SECRET_ACCESS_KEY`
>	- `AWS_SESSION_TOKEN`
