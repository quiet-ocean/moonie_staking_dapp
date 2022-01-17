import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { HttpLink } from 'apollo-link-http'
import { onError } from "apollo-link-error"

const httpLink = new HttpLink({
    uri: "https://graphql.bitquery.io",
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
    },
    fetch,
})

// Error Handling
const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
        graphQLErrors.map(({ message, locations, path }) =>
            console.log(
                `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
            )
        )
    if (networkError) console.log(`[Network error]: ${networkError}`)
})

// Create the apollo client
export const apolloClient = new ApolloClient({
    link: errorLink.concat(httpLink),
    cache: new InMemoryCache(),
    connectToDevTools: true
})

export const apolloProvider = new ApolloProvider({
    client: apolloClient
})