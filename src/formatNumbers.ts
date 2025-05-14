import { getSubscriptNumber, formatSmallNumber, formatAmountWithUnit, formatTokenAmount, formatAmount } from '../../src/utils/commons/utils';

async function run() {
    const subscriptNums = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

    const testCases = [

     
      { number: 1.0012892, showDecimals: 4, showAtLeastDecimals: 0, expected: '1.₂129' },
      { number: 1.0012902, showDecimals: 3, showAtLeastDecimals: 0, expected: '1.₂13' },
      { number: 1.0012902, showDecimals: 2, showAtLeastDecimals: 0, expected: '1.₂1' },
      { number: 1.0012902, showDecimals: 1, showAtLeastDecimals: 1, expected: '1.0' },
      { number: 1.0012902, showDecimals: 1, showAtLeastDecimals: 0, expected: '1' },
        
        { number: 0.10001, showDecimals: 4, showAtLeastDecimals: 4, expected: '0.1₃10' },
        { number: 0.10001, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.1₃1' },
        { number: 0.10001, showDecimals: 2, showAtLeastDecimals: 2, expected: '0.10' },
        { number: 0.10001, showDecimals: 2, showAtLeastDecimals: 0, expected: '0.1' },
        { number: 0.10001, showDecimals: 1, showAtLeastDecimals: 1, expected: '0.1' },
        { number: 0.10001, showDecimals: 1, showAtLeastDecimals: 0, expected: '0.1' },
        { number: 0.10009, showDecimals: 4, showAtLeastDecimals: 4, expected: '0.1₃90' },
        { number: 0.10009, showDecimals: 4, showAtLeastDecimals: 3, expected: '0.1₃9' },
        { number: 0.10009, showDecimals: 4, showAtLeastDecimals: 0, expected: '0.1₃9' },
        { number: 0.10009, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.1₃9' },
        { number: 0.10009, showDecimals: 2, showAtLeastDecimals: 2, expected: '0.10' },
        { number: 0.10009, showDecimals: 2, showAtLeastDecimals: 0, expected: '0.1' },

        { number: 0.1009, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.1₂9' },
        { number: 0.1009, showDecimals: 2, showAtLeastDecimals: 2, expected: '0.10' },
        { number: 0.1009, showDecimals: 2, showAtLeastDecimals: 0, expected: '0.1' },
        
        { number: 0.109, showDecimals: 4, showAtLeastDecimals: 4, expected: '0.1090' },
        { number: 0.109, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.109' },

        { number: 0.000012359, showDecimals: 6, showAtLeastDecimals: 0, expected: '0.₄12359' },
        { number: 0.000012359, showDecimals: 5, showAtLeastDecimals: 0, expected: '0.₄1236' },
        { number: 0.000012359, showDecimals: 4, showAtLeastDecimals: 0, expected: '0.₄124' },
        { number: 0.000012359, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.₄12' },
        { number: 0.123456789, showDecimals: 5, showAtLeastDecimals: 0, expected: '0.12346' },
        { number: 0.00000123, showDecimals: 4, showAtLeastDecimals: 0, expected: '0.₅123' },
        { number: 0.10000001, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.1₆1' },
        { number: 1.00001234, showDecimals: 4, showAtLeastDecimals: 0, expected: '1.₄123' },
        { number: 0.01234567, showDecimals: 4, showAtLeastDecimals: 0, expected: '0.0123' },
        { number: 0.10100001, showDecimals: 4, showAtLeastDecimals: 0, expected: '0.101' },
        { number: 0.00100001, showDecimals: 4, showAtLeastDecimals: 0, expected: '0.₂1₄1' },
        { number: 0.00100001, showDecimals: 3, showAtLeastDecimals: 3, expected: '0.₂10' },
        { number: 0.00100001, showDecimals: 3, showAtLeastDecimals: 0, expected: '0.₂1' },

       
    ];

    console.log('Testing formatSmallNumber...');
    for (const { number, showDecimals, showAtLeastDecimals, expected } of testCases) {
        const result = formatSmallNumber(number, showDecimals, showAtLeastDecimals);
        // First, let's count total decimals we'll need to consider
        const strInitial = number.toString();
        const [, afterDotInitial] = strInitial.split('.');

        // Count how many decimals we'll actually show after grouping zeros
        let totalContinuosZeros = 0;
        let currentZeros = 0;

        for (let i = 0; i < afterDotInitial.length; i++) {
            if (afterDotInitial[i] === '0') {
                currentZeros++; // Increment current zero streak
            } else {
                if (currentZeros > 1) {
                    totalContinuosZeros += currentZeros; // Add streak to total if it's more than 1 zero
                }
                currentZeros = 0; // Reset streak if non-zero encountered
            }
        }

        // Account for a trailing sequence of zeros
        if (currentZeros > 1) {
            totalContinuosZeros += currentZeros;
        }
        //   console.log(
        //       `Number: ${number}, totalContinuosZeros: ${totalContinuosZeros},Show Decimals: ${showDecimals}, showAtLeastDecimals: ${showAtLeastDecimals}, Locale: ${number.toLocaleString(
        //           'en-US',
        //           {
        //               maximumFractionDigits: showDecimals + totalContinuosZeros,
        //               minimumFractionDigits: showAtLeastDecimals + totalContinuosZeros,
        //           }
        //       )}, Expected: ${expected}, Result: ${result}, Pass: ${result === expected}`
        //   );
        console.log(
            `Number: ${number}, totalContinuosZeros: ${totalContinuosZeros}, Show Decimals: ${showDecimals}, showAtLeastDecimals: ${showAtLeastDecimals}, Expected: ${expected}, Result: ${result}, Pass: ${
                result === expected
            }`
        );
    }
}

run();
