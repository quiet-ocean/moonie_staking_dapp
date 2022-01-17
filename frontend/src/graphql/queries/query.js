import gql from 'graphql-tag'

export const LPTOKEN_INFO_QUERY = gql`
    query($address: String!)
    {
      ethereum (network: bsc){
        dexTrades( 
          smartContractAddress: 
          {is:$address}
        ) {
          count
          baseCurrency{
            name
            symbol
          }
          quoteCurrency{
            name
            symbol
          }
        }
      }
    }`

