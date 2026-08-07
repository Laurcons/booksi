import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import type { Env } from "../config/env";

/**
 * RFC 9728 / RFC 8414 discovery documents. A client that gets a 401 from
 * `/mcp` follows `WWW-Authenticate: Bearer resource_metadata=...` here first,
 * then to the authorization-server document, before it ever sees a login
 * screen — docs/MCP.md §3, §4.
 */
@ApiTags("mcp")
@Controller(".well-known")
export class WellKnownController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get apiOrigin(): string {
    return this.config.get("API_ORIGIN", { infer: true });
  }

  @ApiOperation({
    summary: "Metadata de resource server (RFC 9728)",
    description:
      "Spune unui client MCP care e authorization server-ul pentru `/mcp`. " +
      "Publică, fără sesiune — un client n-are cum să aibă vreuna la acest pas.",
  })
  @ApiOkResponse({ description: "`resource` și `authorization_servers`." })
  @Public()
  @Get("oauth-protected-resource")
  protectedResource(): { resource: string; authorization_servers: string[] } {
    return {
      resource: `${this.apiOrigin}/mcp`,
      authorization_servers: [this.apiOrigin],
    };
  }

  @ApiOperation({
    summary: "Metadata de authorization server (RFC 8414)",
    description:
      "Endpoint-urile și metodele PKCE suportate. `S256` e singura metodă de " +
      "PKCE — `plain` nu apare în listă fiindcă nu e acceptată (docs/MCP.md §10).",
  })
  @ApiOkResponse({ description: "Endpoint-urile și grant-urile suportate." })
  @Public()
  @Get("oauth-authorization-server")
  authorizationServer(): {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    revocation_endpoint: string;
    code_challenge_methods_supported: string[];
    grant_types_supported: string[];
    token_endpoint_auth_methods_supported: string[];
  } {
    return {
      issuer: this.apiOrigin,
      authorization_endpoint: `${this.apiOrigin}/oauth/authorize`,
      token_endpoint: `${this.apiOrigin}/oauth/token`,
      revocation_endpoint: `${this.apiOrigin}/oauth/revoke`,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    };
  }
}
