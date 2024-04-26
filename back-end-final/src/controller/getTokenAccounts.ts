import { GetProgramAccountsFilter } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export async function getTokenAccounts(
  wallet: string,
  connect,
  tokenaddress: string
) {
  let targetTokenAmount = null;
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165, //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, //location of our query in the account (bytes)
        bytes: wallet, //our search criteria, a base58 encoded string
      },
    },
  ];
  const accounts = await connect.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    { filters: filters }
  );
  console.log(
    `Found ${accounts.length} token account(s) for wallet ${wallet}.`
  );
  accounts.forEach((account, i) => {
    //Parse the account data
    const parsedAccountInfo: any = account.account.data;
    const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
    if (mintAddress == tokenaddress) {
      targetTokenAmount =
        parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
    }
  });
  return targetTokenAmount ? targetTokenAmount : 0;
}
