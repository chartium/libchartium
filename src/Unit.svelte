<script lang="ts">
  import { SI } from "@m93a/unitlib/systems";

  console.log("base units", SI.baseUnits);
  console.log("factors", SI.factors);
  console.log("kilo", SI.getFactorSymbol({ mul: 1, base: 10, exp: 3 }))
</script>
